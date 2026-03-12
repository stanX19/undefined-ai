"""User ORM model."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from srcs.database import Base


class User(Base):
    """Registered user with email/password authentication."""

    __tablename__ = "users"

    user_id: Mapped[str] = mapped_column(
        String, primary_key=True, default=lambda: uuid.uuid4().hex
    )
    email: Mapped[str] = mapped_column(
        String, unique=True, index=True, nullable=False
    )
    password_hash: Mapped[str] = mapped_column(
        String, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    username: Mapped[str | None] = mapped_column(
        String, nullable=True
    )
    education_level: Mapped[str | None] = mapped_column(
        String, nullable=True
    )

    # Relationships
    topics: Mapped[list["Topic"]] = relationship(  # noqa: F821
        back_populates="user", cascade="all, delete-orphan"
    )
