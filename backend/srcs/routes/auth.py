"""Auth routes — registration, login (JWT-based)."""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address

from srcs.database import get_db
from srcs.schemas.user_dto import RegisterRequest, LoginRequest, TokenResponse, ProfileUpdateRequest, ProfileResponse
from srcs.services.user_service import UserService
from srcs.utils.auth_utils import create_access_token
from srcs.models.user import User
from srcs.dependencies import get_current_user

router: APIRouter = APIRouter(prefix="/api/v1/auth", tags=["auth"])

# Rate limiter scoped to auth endpoints
limiter = Limiter(key_func=get_remote_address)


@router.post("/register", response_model=TokenResponse)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Register a new user with email + password. Returns a JWT."""
    # Check if email already exists
    existing = await UserService.get_user_by_email(db, body.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = await UserService.create_user(
        db,
        email=body.email,
        password=body.password,
        username=body.username,
        education_level=body.education_level,
    )

    access_token = create_access_token(data={"sub": user.user_id})

    return TokenResponse(
        access_token=access_token,
        user_id=user.user_id,
        email=user.email,
        username=user.username,
        education_level=user.education_level,
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,  # required by slowapi
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Authenticate with email + password. Returns a JWT.

    Rate-limited to 5 attempts per minute to mitigate brute-force attacks.
    """
    user = await UserService.authenticate_user(db, body.email, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = create_access_token(data={"sub": user.user_id})

    return TokenResponse(
        access_token=access_token,
        user_id=user.user_id,
        email=user.email,
        username=user.username,
        education_level=user.education_level,
    )


@router.get("/profile", response_model=ProfileResponse)
async def get_profile(
    current_user: User = Depends(get_current_user),
) -> ProfileResponse:
    """Get the authenticated user's profile data."""
    return ProfileResponse(
        user_id=current_user.user_id,
        email=current_user.email,
        username=current_user.username,
        education_level=current_user.education_level,
    )


@router.patch("/profile", response_model=ProfileResponse)
async def update_profile(
    body: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProfileResponse:
    """Update the authenticated user's profile (e.g. education level).

    Requires a valid Bearer token.
    """
    user = await UserService.update_education_level(
        db, current_user, body.education_level
    )
    return ProfileResponse(
        user_id=user.user_id,
        email=user.email,
        username=user.username,
        education_level=user.education_level,
    )
