"""UsageService — global weighted-unit quota enforcement.

Mental checklist:
- Free quota is global per UTC day
- Credits only cover overage
- check_and_consume_units is one atomic transactional operation
- No automatic refunds in v1

Concurrency strategy:
- All mutations use SQL-level column expressions (e.g. units_used = units_used + N)
  so the DB engine evaluates the current value at write time, not the stale
  Python-level snapshot.  After the UPDATE the ORM object is refreshed to
  obtain the real post-update value for overage computation.
- SQLite: concurrent aiosqlite connections hitting the same table trigger
  SQLITE_LOCKED (table-level lock) which is NOT covered by busy_timeout.
  An asyncio.Lock serializes quota mutations so only one coroutine writes
  at a time — matching SQLite's single-writer nature with no throughput loss.
- Postgres: FOR UPDATE on the DailyUsage SELECT reduces wasted work by
  holding a row-level lock until commit; credits_balance is protected by
  a WHERE guard on the UPDATE (rowcount == 0 ⇒ concurrent spend won).
"""
import asyncio
from datetime import datetime, timezone, time

from fastapi import HTTPException
from sqlalchemy import insert, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from srcs.config import get_settings
from srcs.database import _is_sqlite
from srcs.models.daily_usage import DailyUsage
from srcs.models.user import User

_sqlite_quota_lock = asyncio.Lock()


def _today_bucket() -> datetime:
    """Return midnight UTC for the current day."""
    now = datetime.now(timezone.utc)
    return datetime.combine(now.date(), time.min, tzinfo=timezone.utc)


class UsageService:
    """Transactional, concurrency-safe quota enforcement."""

    @staticmethod
    async def check_and_consume_units(
        db: AsyncSession,
        user: User,
        units: int,
    ) -> None:
        """Check quota and consume *units* in a single transaction.

        On SQLite the call is serialized through ``_sqlite_quota_lock``
        to avoid SQLITE_LOCKED (table-level lock) errors that
        ``busy_timeout`` does not cover.

        Raises ``HTTPException(429)`` when the user cannot cover the
        overage with their ``credits_balance``.
        """
        if units <= 0:
            raise HTTPException(status_code=400, detail="units must be greater than 0")
        if _is_sqlite:
            async with _sqlite_quota_lock:
                return await UsageService._check_and_consume(db, user, units)
        return await UsageService._check_and_consume(db, user, units)

    @staticmethod
    async def _check_and_consume(
        db: AsyncSession,
        user: User,
        units: int,
    ) -> None:
        settings = get_settings()
        daily_free = settings.RATE_LIMIT_FREE_UNITS_BY_PLAN.get(
            user.plan_tier, settings.RATE_LIMIT_FREE_UNITS_BY_PLAN.get("free", 10)
        )

        bucket = _today_bucket()

        row = await UsageService._get_or_create_daily_row(db, user.user_id, bucket)

        # --- atomic increment via SQL expression ---
        await db.execute(
            update(DailyUsage)
            .where(DailyUsage.id == row.id)
            .values(units_used=DailyUsage.units_used + units)
        )

        await db.refresh(row)

        pre_update_used = row.units_used - units

        overage_before = max(0, pre_update_used - daily_free)
        overage_after = max(0, row.units_used - daily_free)
        incremental_overage = overage_after - overage_before

        if incremental_overage <= 0:
            await db.commit()
            return

        # --- atomic credits deduction with WHERE guard ---
        result = await db.execute(
            update(User)
            .where(User.user_id == user.user_id)
            .where(User.credits_balance >= incremental_overage)
            .values(credits_balance=User.credits_balance - incremental_overage)
        )

        if result.rowcount == 0:
            await db.rollback()
            await db.refresh(user)
            remaining_free = max(0, daily_free - pre_update_used)
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Daily quota exceeded",
                    "daily_free_units": daily_free,
                    "units_used_today": pre_update_used,
                    "units_requested": units,
                    "free_remaining": remaining_free,
                    "credits_balance": user.credits_balance,
                    "credits_needed": incremental_overage,
                },
            )

        await db.commit()
        await db.refresh(user)

    # ------------------------------------------------------------------

    @staticmethod
    async def _get_or_create_daily_row(
        db: AsyncSession,
        user_id: str,
        bucket: datetime,
    ) -> DailyUsage:
        """Fetch or create the DailyUsage row, handling concurrent inserts.

        SQLite: uses ``INSERT OR IGNORE`` to avoid savepoint/IntegrityError
        complications with aiosqlite under concurrent writes.
        Postgres: uses a savepoint so an IntegrityError doesn't abort the
        outer transaction, plus ``FOR UPDATE`` row locking.
        """
        sel = select(DailyUsage).where(
            DailyUsage.user_id == user_id,
            DailyUsage.bucket_start_utc == bucket,
        )
        if not _is_sqlite:
            sel = sel.with_for_update()

        result = await db.execute(sel)
        row = result.scalar_one_or_none()
        if row is not None:
            return row

        if _is_sqlite:
            await db.execute(
                insert(DailyUsage)
                .prefix_with("OR IGNORE")
                .values(user_id=user_id, bucket_start_utc=bucket, units_used=0)
            )
            result = await db.execute(sel)
            return result.scalar_one()

        # Postgres path — savepoint protects the outer transaction.
        row = DailyUsage(
            user_id=user_id,
            bucket_start_utc=bucket,
            units_used=0,
        )
        try:
            async with db.begin_nested():
                db.add(row)
                await db.flush()
        except IntegrityError:
            result = await db.execute(sel)
            row = result.scalar_one()
        return row
