"""ChatMessage ORM model."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from srcs.database import Base


class ChatMessage(Base):
    """A single chat message (user or assistant) within a topic."""

    __tablename__ = "chat_history"

    message_id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: uuid.uuid4().hex
    )
    topic_id: Mapped[str] = mapped_column(
        String, ForeignKey("topics.topic_id"), nullable=False
    )
    role: Mapped[str] = mapped_column(String, nullable=False)  # "user" | "assistant"
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    topic: Mapped["Topic"] = relationship(back_populates="messages")  # noqa: F821
