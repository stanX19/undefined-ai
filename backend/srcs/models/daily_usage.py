"""DailyUsage ORM model — tracks global unit consumption per user per UTC day."""
from datetime import datetime

from sqlalchemy import Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from srcs.database import Base


class DailyUsage(Base):
    """One row per user per UTC day. Stores total units consumed."""

    __tablename__ = "daily_usage"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.user_id"), nullable=False, index=True
    )
    bucket_start_utc: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    units_used: Mapped[int] = mapped_column(
        Integer, server_default='0', nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id", "bucket_start_utc",
            name="uq_daily_usage_user_bucket",
        ),
    )
