"""Health-check route."""
from fastapi import APIRouter

router: APIRouter = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> dict[str, str]:
    """Simple liveness probe."""
    return {"status": "healthy"}
