"""Auth routes — simple ID-based login (POC, no JWT)."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from srcs.database import get_db
from srcs.schemas.user_dto import LoginRequest, LoginResponse
from srcs.services.user_service import UserService

router: APIRouter = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    """Login (or register) by user ID. Returns user info."""
    user = await UserService.get_or_create_user(
        db, 
        body.user_id, 
        education_level=body.education_level
    )
    return LoginResponse.model_validate(user)
