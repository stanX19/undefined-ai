"""Auth / User DTOs."""
import re
from datetime import datetime

from pydantic import BaseModel, field_validator


class RegisterRequest(BaseModel):
    """Registration request with password strength validation."""
    email: str
    password: str
    username: str
    education_level: str | None = None

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Username must be at least 2 characters")
        if len(v) > 50:
            raise ValueError("Username must be at most 50 characters")
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("Invalid email address")
        return v

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[a-zA-Z]", v):
            raise ValueError("Password must contain at least one letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number")
        return v


class LoginRequest(BaseModel):
    """Email + password login request."""
    email: str
    password: str


class TokenResponse(BaseModel):
    """JWT token response — never exposes password_hash."""
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    username: str | None = None
    education_level: str | None = None
    plan_tier: str = "free"
    credits_balance: int = 0


class ProfileUpdateRequest(BaseModel):
    """Request to update user profile fields."""
    education_level: str


class ProfileResponse(BaseModel):
    """Safe user profile response — never exposes password_hash."""
    user_id: str
    email: str
    username: str | None = None
    education_level: str | None = None
    plan_tier: str = "free"
    credits_balance: int = 0

    model_config = {"from_attributes": True}
