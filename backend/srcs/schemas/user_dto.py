"""Auth / User DTOs."""
from datetime import datetime

from pydantic import BaseModel


class LoginRequest(BaseModel):
    """Simple ID-based login request (POC — no JWT)."""
    user_id: str


class LoginResponse(BaseModel):
    """Login response with user info."""
    user_id: str
    created_at: datetime

    model_config = {"from_attributes": True}
