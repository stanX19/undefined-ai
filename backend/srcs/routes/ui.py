"""UI route — read the current MarkGraph Document for a topic."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from srcs.database import get_db
from srcs.schemas.ui_dto import UIResponse
from srcs.services.ui_service import UIService
from srcs.utils.markgraph.markgraph_parser import compile_markgraph, export_to_dict

router = APIRouter(prefix="/api/v1/ui", tags=["UI"])


@router.get("/{topic_id}", response_model=UIResponse)
async def get_ui(topic_id: str, db: AsyncSession = Depends(get_db)):
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


if __name__ == "__main__":
    print("UI route loaded OK")
    for route in router.routes:
        print(f"  {route.methods} {route.path}")  # type: ignore[attr-defined]
