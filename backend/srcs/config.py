"""
Environment configuration for backend.
"""
import os.path
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    ROOT: str = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    UPLOAD_DIR: str = os.path.join(ROOT, "uploads")

    # Gemini Configuration
    GEMINI_API_KEY: str = ""
    GEMINI_API_KEY_LIST: list[str] = []
    GEMINI_MODEL_NAME: str = "gemini-2.5-flash"
    STRONG_GEMINI_MODEL_NAME: str = "gemini-2.5-flash"

    # Exa (Web Search) Configuration
    EXA_API_KEY: str = ""

    # Firebase Configuration
    FIREBASE_CREDENTIALS_JSON_PATH: str = "firebase_key.json"

    # Database Configuration
    USE_IN_MEMORY_DB: bool = False
    DB_NAME: str = "rasmiai.db"

    # Application Settings
    DEBUG: bool = False
    PORT: int = 8000
    FAKE_LOGIN_TOKEN: str | None = "fake_demo_token_123"

    model_config = SettingsConfigDict(
        env_file=f"{ROOT}/.env",
        env_file_encoding="utf-8",
        extra="allow"  # Allow extra fields from .env without explicit definition
    )

@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()