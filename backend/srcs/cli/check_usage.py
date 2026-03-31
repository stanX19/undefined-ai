"""Check user usage from the terminal."""
from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import date, datetime, time, timezone

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from srcs.database import AsyncSessionLocal
from srcs.models.daily_usage import DailyUsage
from srcs.models.user import User


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Show per-user usage for a given UTC day (default: today)."
    )
    parser.add_argument(
        "--date",
        dest="date_str",
        default=None,
        help="UTC date in YYYY-MM-DD format. Defaults to today (UTC).",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Show all-time usage instead of a single day.",
    )
    parser.add_argument(
        "--desc",
        action="store_true",
        help="Sort by units used descending.",
    )
    return parser.parse_args(argv)


def _bucket_for_date(target_date: date) -> datetime:
    """Return midnight UTC bucket for a given date."""
    return datetime.combine(target_date, time.min, tzinfo=timezone.utc)


def _parse_date(date_str: str | None) -> date:
    if date_str is None:
        return datetime.now(timezone.utc).date()
    try:
        return date.fromisoformat(date_str)
    except ValueError as exc:
        raise ValueError("Invalid --date. Use YYYY-MM-DD.") from exc


async def _run(args: argparse.Namespace) -> int:
    label = "units_used"
    bucket = None

    if not args.all:
        bucket = _bucket_for_date(_parse_date(args.date_str))
        label = "units_used_today"

    async with AsyncSessionLocal() as session:
        session = session  # type: AsyncSession
        units_col = func.coalesce(func.sum(DailyUsage.units_used), 0).label(label)

        join_cond = User.user_id == DailyUsage.user_id
        if bucket is not None:
            join_cond = and_(join_cond, DailyUsage.bucket_start_utc == bucket)

        query = (
            select(User.email, User.plan_tier, User.credits_balance, units_col)
            .outerjoin(DailyUsage, join_cond)
            .group_by(User.user_id, User.email, User.plan_tier, User.credits_balance)
        )
        query = query.order_by(units_col.desc() if args.desc else units_col.asc())

        try:
            result = await session.execute(query)
            rows = result.all()
        except Exception as exc:
            print(f"Error executing query: {exc}", file=sys.stderr)
            return 1

    print("-" * 75)
    print(f"{'Email':<30} | {'Plan':<10} | {'Credits':<8} | {'Units Used':<15}")
    print("-" * 75)
    for row in rows:
        print(f"{row[0]:<30} | {row[1]:<10} | {row[2]:<8} | {row[3]:<15}")
    print("-" * 75)
    if not rows:
        print("No users found in the database.")
    return 0


def main(argv: list[str] | None = None) -> int:
    try:
        args = _parse_args(argv)
        return asyncio.run(_run(args))
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
