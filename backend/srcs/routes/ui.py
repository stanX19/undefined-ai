"""UI route — read the current MarkGraph Document for a topic."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from srcs.config import get_settings
from srcs.database import get_db
from srcs.schemas.ui_dto import UIResponse, UIHistoryResponse, RollbackRequest, ShareResponse
from srcs.services.topic_service import TopicService
from srcs.services.ui_service import UIService
from srcs.services.usage_service import UsageService
from srcs.utils.markgraph.markgraph_parser import compile_markgraph, export_to_dict
from srcs.dependencies import get_current_user
from srcs.models.user import User
from srcs.models.scene import Scene
from srcs.models.topic import Topic

router = APIRouter(prefix="/api/v1/ui", tags=["UI"])


async def _consume_ui_units(db: AsyncSession, current_user: User) -> None:
    settings = get_settings()
    await UsageService.check_and_consume_units(db, current_user, settings.UNIT_COST_UI)


async def _get_owned_topic_or_404(
    db: AsyncSession,
    topic_id: str,
    current_user: User,
) -> Topic:
    topic = await TopicService.get_user_topic(db, topic_id, current_user.user_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic


def _build_ui_response(scene: Scene) -> UIResponse:
    result = compile_markgraph(scene.ui_markdown)
    ast_dict = export_to_dict(result.scenes)
    ui_json = {
        "version": "0.2",
        "scenes": ast_dict,
        "id_map": {k: export_to_dict(v) for k, v in result.id_map.items()}
    }

    return UIResponse(
        scene_id=scene.scene_id,
        topic_id=scene.topic_id,
        ui_markdown=scene.ui_markdown,
        ui_json=ui_json,
        created_at=scene.created_at,
    )


@router.get("/{topic_id}", response_model=UIResponse)
async def get_ui(
    topic_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Return the current UI scene for a topic.

    If no scene exists yet, creates an empty default scene and returns it.
    """
    await _get_owned_topic_or_404(db, topic_id, current_user)
    settings = get_settings()
    await _consume_ui_units(db, current_user)
    try:
        scene = await UIService.get_or_create_scene(db, topic_id)
        return _build_ui_response(scene)
    except Exception:
        await db.rollback()
        await UsageService.safe_refund_units(db, current_user, settings.UNIT_COST_UI)
        raise


@router.get("/{topic_id}/history", response_model=UIHistoryResponse)
async def get_ui_history(
    topic_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Return the historical versions of the UI for this topic."""
    await _get_owned_topic_or_404(db, topic_id, current_user)
    settings = get_settings()
    await _consume_ui_units(db, current_user)
    try:
        history = await UIService.get_history(db, topic_id)
        return UIHistoryResponse(versions=history)
    except Exception:
        await db.rollback()
        await UsageService.safe_refund_units(db, current_user, settings.UNIT_COST_UI)
        raise


@router.post("/{topic_id}/rollback", response_model=UIResponse)
async def rollback_ui(
    topic_id: str,
    req: RollbackRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Set the topic's current UI pointer to a previous version."""
    await _get_owned_topic_or_404(db, topic_id, current_user)
    result = await db.execute(
        select(Scene, Topic.user_id)
        .join(Topic, Scene.topic_id == Topic.topic_id)
        .where(Scene.scene_id == req.scene_id)
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=404, detail="Scene not found")

    scene_obj, owner_user_id = row
    if owner_user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this topic")
    if scene_obj.topic_id != topic_id:
        raise HTTPException(status_code=400, detail="Scene does not belong to the specified topic")

    settings = get_settings()
    await _consume_ui_units(db, current_user)
    try:
        await UIService.set_current_ui_to_version(db, topic_id, req.scene_id)
        scene = await UIService.get_or_create_scene(db, topic_id)
        return _build_ui_response(scene)
    except Exception:
        await db.rollback()
        await UsageService.safe_refund_units(db, current_user, settings.UNIT_COST_UI)
        raise


@router.post("/share/{scene_id}", response_model=ShareResponse)
async def share_ui(
    scene_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate a share token for a specific scene."""
    # Ensure the scene exists and belongs to the current user before creating a share.
    result = await db.execute(
        select(Scene, Topic.user_id)
        .join(Topic, Scene.topic_id == Topic.topic_id)
        .where(Scene.scene_id == scene_id)
    )
    row = result.first()
    if row is None:
        # Scene does not exist
        raise HTTPException(status_code=404, detail="Scene not found")

    _, owner_user_id = row
    if owner_user_id != current_user.user_id:
        # Scene exists but is not owned by the current user
        raise HTTPException(status_code=403, detail="Not authorized to share this scene")

    await _consume_ui_units(db, current_user)
    settings = get_settings()
    try:
        token = await UIService.create_share(db, scene_id)
        return ShareResponse(
            token=token,
            share_url=f"/share/{token}"
        )
    except ValueError as e:
        await db.rollback()
        await UsageService.safe_refund_units(db, current_user, settings.UNIT_COST_UI)
        raise HTTPException(status_code=404, detail=str(e))
    except Exception:
        await db.rollback()
        await UsageService.safe_refund_units(db, current_user, settings.UNIT_COST_UI)
        raise


@router.get("/public/{token}", response_model=UIResponse)
async def get_public_ui(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """Return UI data for a public share. No auth required."""
    scene = await UIService.get_scene_by_share_id(db, token)

    if not scene:
        raise HTTPException(status_code=404, detail="Shared UI not found")

    return _build_ui_response(scene)


if __name__ == "__main__":
    print("UI route loaded OK")
    for route in router.routes:
        print(f"  {route.methods} {route.path}")  # type: ignore[attr-defined]
