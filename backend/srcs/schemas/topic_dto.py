"""Topic DTOs."""
from datetime import datetime

from pydantic import BaseModel


class TopicCreateRequest(BaseModel):
    """Request body for creating a new topic."""
    title: str


class TopicResponse(BaseModel):
    """Standard topic response."""
    topic_id: str
    user_id: str
    title: str
    difficulty_level: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TopicDetailResponse(TopicResponse):
    """Topic response including the stored document text."""
    document_text: str | None = None
