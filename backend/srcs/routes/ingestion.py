"""Ingestion routes — pipeline status and fact browsing."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from srcs.database import get_db
from srcs.schemas.ingestion_dto import (
    IngestionStatusResponse,
    AtomicFactResponse,
    FactWithParentsResponse,
)
from srcs.services.ingestion_service import IngestionService
from srcs.services.retrieval_service import RetrievalService
from srcs.dependencies import get_current_user
from srcs.models.user import User

router: APIRouter = APIRouter(prefix="/api/v1/ingestion", tags=["ingestion"])


@router.get("/{topic_id}/status", response_model=IngestionStatusResponse)
async def get_ingestion_status(
    topic_id: str,
    current_user: User = Depends(get_current_user),
) -> IngestionStatusResponse:
    """Return the current ingestion pipeline status for a topic."""
    status: str = IngestionService.get_status(topic_id)
    return IngestionStatusResponse(topic_id=topic_id, status=status)


@router.get("/{topic_id}/facts", response_model=list[AtomicFactResponse])
async def list_facts(
    topic_id: str,
    level: int = Query(..., ge=0, description="Fact compression level (0 = raw, 1 = atomic, 2+ = compressed)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AtomicFactResponse]:
    """List all facts for a topic at a specific compression level."""
    facts = await RetrievalService.get_facts_by_level(db, topic_id, level)
    return [AtomicFactResponse.model_validate(f) for f in facts]


@router.get("/{topic_id}/facts/{fact_id}", response_model=FactWithParentsResponse)
async def get_fact_with_parents(
    topic_id: str,
    fact_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FactWithParentsResponse:
    """Get a single fact with its full parent chain and source chunk."""
    result = await RetrievalService.get_fact_with_parents(db, fact_id)
    if not result:
        raise HTTPException(status_code=404, detail="Fact not found")
    return result
