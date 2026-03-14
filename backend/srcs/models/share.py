"""Share model — persists public sharing tokens for UI scenes."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey
from srcs.database import Base

class Share(Base):
    """A public sharing link for a specific UI scene."""
    __tablename__ = "shares"

    share_id: str = Column(
        String, primary_key=True, default=lambda: uuid.uuid4().hex
    )
    scene_id: str = Column(
        String, ForeignKey("scenes.scene_id"), nullable=False, index=True, unique=True
    )
    created_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
