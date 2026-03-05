"""Scene model — persists MarkGraph protocol documents per topic."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, ForeignKey, Text

from srcs.database import Base


class Scene(Base):
    """A single UI scene stored as a raw MarkGraph markdown document."""

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
    # Changed from ui_json (JSON) to ui_markdown (Text) for MarkGraph
    ui_markdown: str = Column(Text, nullable=False, default="")
    created_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


if __name__ == "__main__":
    print("Scene model loaded OK")
    s = Scene(topic_id="test", ui_markdown="# Root Scene\nHello world")
    print(f"  scene_id={s.scene_id}, topic_id={s.topic_id}")
    print(f"  ui_markdown={s.ui_markdown}")
