"""TopicProgress ORM model — tracks user learning progress per topic."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from srcs.database import Base


class TopicProgress(Base):
    """Per-user, per-topic progress record.

    Tracks the last fact visited and when the user last engaged with the topic.
    Used by the recommendation service to determine the user's current position.
    """

    __tablename__ = "topic_progress"

    progress_id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: uuid.uuid4().hex
    )
    topic_id: Mapped[str] = mapped_column(
        String, ForeignKey("topics.topic_id"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.user_id"), nullable=False
    )
    last_fact_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("atomic_facts.fact_id"), nullable=True
    )
    last_accessed: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    topic: Mapped["Topic"] = relationship()  # noqa: F821
    user: Mapped["User"] = relationship()  # noqa: F821
