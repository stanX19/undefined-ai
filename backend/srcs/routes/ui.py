"""UI route — read the current A2UI JSON for a topic."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from srcs.database import get_db
from srcs.schemas.ui_dto import UIResponse
from srcs.services.ui_service import UIService

router = APIRouter(prefix="/api/v1/ui", tags=["UI"])


@router.get("/{topic_id}", response_model=UIResponse)
async def get_ui(topic_id: str, db: AsyncSession = Depends(get_db)):
    """Return the current UI scene for a topic.

    If no scene exists yet, creates an empty default scene and returns it.
    """
    scene = await UIService.get_or_create_scene(db, topic_id)
    return scene


if __name__ == "__main__":
    print("UI route loaded OK")
    for route in router.routes:
        print(f"  {route.methods} {route.path}")  # type: ignore[attr-defined]
