"""UI route — read the current MarkGraph Document for a topic."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from srcs.database import get_db
from srcs.schemas.ui_dto import UIResponse, UIHistoryResponse, RollbackRequest
from srcs.services.ui_service import UIService
from srcs.utils.markgraph.markgraph_parser import compile_markgraph, export_to_dict
from srcs.dependencies import get_current_user
from srcs.models.user import User

router = APIRouter(prefix="/api/v1/ui", tags=["UI"])


@router.get("/{topic_id}", response_model=UIResponse)
async def get_ui(
    topic_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Return the current UI scene for a topic.

    If no scene exists yet, creates an empty default scene and returns it.
    """
    scene = await UIService.get_or_create_scene(db, topic_id)
    
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


@router.get("/{topic_id}/history", response_model=UIHistoryResponse)
async def get_ui_history(
    topic_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Return the historical versions of the UI for this topic."""
    history = await UIService.get_history(db, topic_id)
    return UIHistoryResponse(versions=history)


@router.post("/{topic_id}/rollback", response_model=UIResponse)
async def rollback_ui(
    topic_id: str,
    req: RollbackRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Set the topic's current UI pointer to a previous version."""
    await UIService.set_current_ui_to_version(db, topic_id, req.scene_id)
    # Return the new current UI
    return await get_ui(topic_id, current_user, db)


if __name__ == "__main__":
    print("UI route loaded OK")
    for route in router.routes:
        print(f"  {route.methods} {route.path}")  # type: ignore[attr-defined]
