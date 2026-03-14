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
    ui_markdown: str


# -- REST responses ------------------------------------------------------------

class UIResponse(BaseModel):
    """Full scene returned to the frontend."""
    scene_id: str
    topic_id: str
    ui_json: dict[str, Any]
    ui_markdown: str
    created_at: datetime

    model_config = {"from_attributes": True}


# -- History & Rollback --------------------------------------------------------

class UIHistoryItem(BaseModel):
    """Summary of a historical scene version."""
    scene_id: str
    created_at: datetime
    description: str  # Extra information about the scene (e.g. first heading)


class UIHistoryResponse(BaseModel):
    """List of historical scene versions."""
    versions: list[UIHistoryItem]


class RollbackRequest(BaseModel):
    """Request to point Topic.current_scene_id back to an old scene."""
    scene_id: str


class ShareResponse(BaseModel):
    """Response containing the public share token (hash)."""
    token: str
    share_url: str


if __name__ == "__main__":
    sample = UIResponse(
        scene_id="s1",
        topic_id="t1",
        ui_json={"version": "0.2"},
        ui_markdown="# Scene",
        created_at=datetime.now(),
    )
    print(sample.model_dump_json(indent=2))
