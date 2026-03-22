"""Recommendation routes — LLM-powered topic suggestions."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from srcs.config import get_settings
from srcs.database import get_db
from srcs.schemas.recommendation_dto import (
    RecommendationsResponse,
    RecommendationItem,
    ProgressUpdateRequest,
    TopicProgressResponse,
)
from srcs.services.recommendation_service import RecommendationService
from srcs.services.topic_service import TopicService
from srcs.services.usage_service import UsageService
from srcs.dependencies import get_current_user
from srcs.models.user import User

router: APIRouter = APIRouter(
    prefix="/api/v1/recommendations", tags=["recommendations"],
)


@router.get("/default", response_model=RecommendationsResponse)
async def get_default_recommendations(
    education_level: str = Query(..., description="The user's selected education level"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RecommendationsResponse:
    """Return 3 introductory suggested topics based on education level."""
    settings = get_settings()
    await UsageService.check_and_consume_units(db, current_user, settings.UNIT_COST_RECOMMENDATIONS)

    results = await RecommendationService.get_default_recommendations(education_level)

    return RecommendationsResponse(
        topic_id=None,
        current_difficulty=None,
        recommendations=[RecommendationItem(**r) for r in results],
    )


@router.get("/latest", response_model=RecommendationsResponse)
async def get_latest_recommendations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RecommendationsResponse:
    """Return 3 suggested topics based on the user's most recent topic."""
    topics = await TopicService.get_user_topics(db, current_user.user_id)
    if not topics:
        raise HTTPException(status_code=404, detail="User has no topics")

    latest_topic = topics[0]

    settings = get_settings()
    await UsageService.check_and_consume_units(db, current_user, settings.UNIT_COST_RECOMMENDATIONS)

    results = await RecommendationService.get_recommendations(current_user.user_id, latest_topic.topic_id)

    return RecommendationsResponse(
        topic_id=latest_topic.topic_id,
        current_difficulty=latest_topic.difficulty_level,
        recommendations=[RecommendationItem(**r) for r in results],
    )


@router.get("/{topic_id}", response_model=RecommendationsResponse)
async def get_recommendations(
    topic_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RecommendationsResponse:
    """Return 3 suggested topics: same level, +1, +2 harder."""
    topic = await TopicService.get_user_topic(db, topic_id, current_user.user_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    settings = get_settings()
    await UsageService.check_and_consume_units(db, current_user, settings.UNIT_COST_RECOMMENDATIONS)

    results = await RecommendationService.get_recommendations(current_user.user_id, topic_id)

    return RecommendationsResponse(
        topic_id=topic_id,
        current_difficulty=topic.difficulty_level,
        recommendations=[RecommendationItem(**r) for r in results],
    )


@router.post("/{topic_id}/progress", response_model=TopicProgressResponse)
async def update_progress(
    topic_id: str,
    body: ProgressUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TopicProgressResponse:
    """Record the user's latest progress on a topic."""
    topic = await TopicService.get_user_topic(db, topic_id, current_user.user_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    progress = await RecommendationService.update_progress(
        db, current_user.user_id, topic_id, body.last_fact_id,
    )
    return TopicProgressResponse.model_validate(progress)
