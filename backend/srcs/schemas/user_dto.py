"""Auth / User DTOs."""
from datetime import datetime

from pydantic import BaseModel


class LoginRequest(BaseModel):
    """Simple ID-based login request (POC — no JWT)."""
    user_id: str
    education_level: str | None = None


class LoginResponse(BaseModel):
    """Login response with user info."""
    user_id: str
    created_at: datetime
    education_level: str | None = None

    model_config = {"from_attributes": True}
