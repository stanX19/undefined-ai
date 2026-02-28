"""Recommendation DTOs — request/response schemas for topic suggestions."""
from datetime import datetime

from pydantic import BaseModel


class RecommendationItem(BaseModel):
    """A single topic suggestion."""
    title: str
    difficulty: int
    reason: str


class RecommendationsResponse(BaseModel):
    """Response containing recommended topics."""
    topic_id: str | None = None
    current_difficulty: int | None
    recommendations: list[RecommendationItem]


class ProgressUpdateRequest(BaseModel):
    """Request body for updating learning progress."""
    user_id: str
    last_fact_id: str | None = None


class TopicProgressResponse(BaseModel):
    """Progress record returned by the API."""
    progress_id: str
    topic_id: str
    user_id: str
    last_fact_id: str | None = None
    last_accessed: datetime

    model_config = {"from_attributes": True}
