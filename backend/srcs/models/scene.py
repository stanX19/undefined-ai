"""Scene model — persists A2UI protocol documents per topic."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, ForeignKey, JSON

from srcs.database import Base


class Scene(Base):
    """A single UI scene stored as a full A2UI v3.0 JSON document."""

    __tablename__ = "scenes"

    scene_id: str = Column(
        String, primary_key=True, default=lambda: str(uuid.uuid4())
    )
    topic_id: str = Column(
        String, ForeignKey("topics.topic_id"), nullable=False, index=True
    )
    parent_scene_id: str | None = Column(
        String, ForeignKey("scenes.scene_id"), nullable=True
    )
    ui_json: dict = Column(JSON, nullable=False, default=dict)
    created_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


if __name__ == "__main__":
    print("Scene model loaded OK")
    s = Scene(topic_id="test", ui_json={"version": "3.0"})
    print(f"  scene_id={s.scene_id}, topic_id={s.topic_id}")
    print(f"  ui_json={s.ui_json}")
