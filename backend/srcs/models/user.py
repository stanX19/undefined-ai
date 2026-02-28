"""User ORM model."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from srcs.database import Base


class User(Base):
    """Represents a registered user (POC: login by ID only)."""

    __tablename__ = "users"

    user_id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: uuid.uuid4().hex
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    topics: Mapped[list["Topic"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
