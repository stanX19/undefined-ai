"""UI DTOs — request/response models and SSE payloads for the UI system."""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


# -- SSE payload ---------------------------------------------------------------

class SseUIUpdateData(BaseModel):
    """Pushed over SSE when the UIAgent finishes editing a scene."""
    topic_id: str
    scene_id: str
    ui_json: dict[str, Any]


# -- REST responses ------------------------------------------------------------

class UIResponse(BaseModel):
    """Full scene returned to the frontend."""
    scene_id: str
    topic_id: str
    ui_json: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


if __name__ == "__main__":
    sample = UIResponse(
        scene_id="s1",
        topic_id="t1",
        ui_json={"version": "3.0", "root_id": "main", "elements": {}},
        created_at=datetime.now(),
    )
    print(sample.model_dump_json(indent=2))
