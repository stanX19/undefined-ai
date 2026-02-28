"""AtomicFact ORM model — hierarchical knowledge facts extracted from documents."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from srcs.database import Base


class AtomicFact(Base):
    """A single knowledge fact at a specific compression level.

    Levels:
        0 = raw document text
        1 = atomic fact (extracted by LLM)
        2+ = progressively compressed summaries (higher = more condensed)
    """

    __tablename__ = "atomic_facts"

    fact_id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: uuid.uuid4().hex
    )
    topic_id: Mapped[str] = mapped_column(
        String, ForeignKey("topics.topic_id"), nullable=False
    )
    parent_fact_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("atomic_facts.fact_id"), nullable=True
    )
    level: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    # Source provenance — traces back to original document text
    source_chunk_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("atomic_facts.fact_id"), nullable=True
    )
    source_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_end: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    topic: Mapped["Topic"] = relationship(back_populates="facts")  # noqa: F821
    parent: Mapped["AtomicFact | None"] = relationship(
        "AtomicFact",
        remote_side="AtomicFact.fact_id",
        foreign_keys=[parent_fact_id],
        back_populates="children",
    )
    children: Mapped[list["AtomicFact"]] = relationship(
        "AtomicFact",
        foreign_keys=[parent_fact_id],
        back_populates="parent",
    )
    source_chunk: Mapped["AtomicFact | None"] = relationship(
        "AtomicFact",
        remote_side="AtomicFact.fact_id",
        foreign_keys=[source_chunk_id],
    )
