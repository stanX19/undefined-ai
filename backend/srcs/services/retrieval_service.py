"""Retrieval service — hierarchy-based fact retrieval (no vector DB)."""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from srcs.models.atomic_fact import AtomicFact
from srcs.schemas.ingestion_dto import AtomicFactResponse, FactWithParentsResponse


class RetrievalService:
    """Query the atomic-fact hierarchy stored in the DB."""

    @staticmethod
    async def get_facts_by_level(
        db: AsyncSession, topic_id: str, level: int,
    ) -> list[AtomicFact]:
        """Return all facts for a topic at a given compression level."""
        result = await db.execute(
            select(AtomicFact)
            .where(AtomicFact.topic_id == topic_id, AtomicFact.level == level)
            .order_by(AtomicFact.created_at.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_fact(db: AsyncSession, fact_id: str) -> AtomicFact | None:
        """Fetch a single fact by ID."""
        result = await db.execute(
            select(AtomicFact).where(AtomicFact.fact_id == fact_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_facts_by_ids(db: AsyncSession, fact_ids: list[str]) -> list[AtomicFact]:
        """Fetch multiple facts by their IDs."""
        if not fact_ids:
            return []
        
        result = await db.execute(
            select(AtomicFact).where(AtomicFact.fact_id.in_(fact_ids))
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_children(db: AsyncSession, fact_id: str) -> list[AtomicFact]:
        """Return direct children of a fact."""
        result = await db.execute(
            select(AtomicFact)
            .where(AtomicFact.parent_fact_id == fact_id)
            .order_by(AtomicFact.created_at.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_fact_with_parents(
        db: AsyncSession, fact_id: str,
    ) -> FactWithParentsResponse | None:
        """Walk the parent chain from *fact_id* up to root.

        Also resolves `source_chunk_id` to include the raw text chunk.
        """
        fact = await RetrievalService.get_fact(db, fact_id)
        if not fact:
            return None

        parents: list[AtomicFact] = []
        current: AtomicFact | None = fact

        # Walk parent_fact_id chain
        while current and current.parent_fact_id:
            parent = await RetrievalService.get_fact(db, current.parent_fact_id)
            if not parent:
                break
            parents.append(parent)
            current = parent

        # Resolve source chunk
        source_chunk: AtomicFact | None = None
        if fact.source_chunk_id:
            source_chunk = await RetrievalService.get_fact(db, fact.source_chunk_id)

        return FactWithParentsResponse(
            fact=AtomicFactResponse.model_validate(fact),
            parents=[AtomicFactResponse.model_validate(p) for p in parents],
            source_chunk=AtomicFactResponse.model_validate(source_chunk) if source_chunk else None,
        )

    @staticmethod
    async def has_facts(db: AsyncSession, topic_id: str) -> bool:
        """Check whether any ingested facts exist for a topic."""
        result = await db.execute(
            select(AtomicFact.fact_id)
            .where(AtomicFact.topic_id == topic_id)
            .limit(1)
        )
        return result.scalar_one_or_none() is not None

    @staticmethod
    async def get_max_level(db: AsyncSession, topic_id: str) -> int | None:
        """Return the highest compression level available for a topic, or None."""
        result = await db.execute(
            select(func.max(AtomicFact.level))
            .where(AtomicFact.topic_id == topic_id)
        )
        return result.scalar_one_or_none()
