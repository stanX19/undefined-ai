"""Recommendation routes — LLM-powered topic suggestions."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from srcs.database import get_db
from srcs.schemas.recommendation_dto import (
    RecommendationsResponse,
    RecommendationItem,
    ProgressUpdateRequest,
    TopicProgressResponse,
)
from srcs.services.recommendation_service import RecommendationService
from srcs.services.topic_service import TopicService

router: APIRouter = APIRouter(
    prefix="/api/v1/recommendations", tags=["recommendations"],
)


@router.get("/default", response_model=RecommendationsResponse)
async def get_default_recommendations(
    education_level: str = Query(..., description="The user's selected education level"),
) -> RecommendationsResponse:
    """Return 3 introductory suggested topics based on education level."""
    results = await RecommendationService.get_default_recommendations(education_level)

    return RecommendationsResponse(
        topic_id=None,
        current_difficulty=None,
        recommendations=[RecommendationItem(**r) for r in results],
    )


@router.get("/latest", response_model=RecommendationsResponse)
async def get_latest_recommendations(
    user_id: str = Query(..., description="The user requesting recommendations"),
    db: AsyncSession = Depends(get_db),
) -> RecommendationsResponse:
    """Return 3 suggested topics based on the user's most recent topic."""
    topics = await TopicService.get_user_topics(db, user_id)
    if not topics:
        raise HTTPException(status_code=404, detail="User has no topics")
        
    latest_topic = topics[0]
    results = await RecommendationService.get_recommendations(db, user_id, latest_topic.topic_id)

    return RecommendationsResponse(
        topic_id=latest_topic.topic_id,
        current_difficulty=latest_topic.difficulty_level,
        recommendations=[RecommendationItem(**r) for r in results],
    )


@router.get("/{topic_id}", response_model=RecommendationsResponse)
async def get_recommendations(
    topic_id: str,
    user_id: str = Query(..., description="The user requesting recommendations"),
    db: AsyncSession = Depends(get_db),
) -> RecommendationsResponse:
    """Return 3 suggested topics: same level, +1, +2 harder."""
    topic = await TopicService.get_topic(db, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    results = await RecommendationService.get_recommendations(db, user_id, topic_id)

    return RecommendationsResponse(
        topic_id=topic_id,
        current_difficulty=topic.difficulty_level,
        recommendations=[RecommendationItem(**r) for r in results],
    )


@router.post("/{topic_id}/progress", response_model=TopicProgressResponse)
async def update_progress(
    topic_id: str,
    body: ProgressUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> TopicProgressResponse:
    """Record the user's latest progress on a topic."""
    topic = await TopicService.get_topic(db, topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    progress = await RecommendationService.update_progress(
        db, body.user_id, topic_id, body.last_fact_id,
    )
    return TopicProgressResponse.model_validate(progress)
