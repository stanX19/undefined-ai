"""Ingestion DTOs — request/response schemas for the ingestion pipeline."""
from datetime import datetime

from pydantic import BaseModel


class IngestionStatusResponse(BaseModel):
    """Pipeline status for a topic."""
    topic_id: str
    status: str  # "pending" | "processing" | "completed" | "failed"
    message: str | None = None


class AtomicFactResponse(BaseModel):
    """Single fact returned by the API."""
    fact_id: str
    topic_id: str
    level: int
    content: str
    parent_fact_id: str | None = None
    source_chunk_id: str | None = None
    source_start: int | None = None
    source_end: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class FactWithParentsResponse(BaseModel):
    """A fact accompanied by its full parent chain up to root."""
    fact: AtomicFactResponse
    parents: list[AtomicFactResponse]
    source_chunk: AtomicFactResponse | None = None
