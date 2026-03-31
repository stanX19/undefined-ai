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

    # ElevenLabs (Speech) Configuration
    ELEVENLABS_API_KEY: str = ""
    ELEVENLABS_MODEL: str = "eleven_multilingual_v2"
    ELEVENLABS_DEFAULT_VOICE_ID: str = "PoHUWWWMHFrA8z7Q88pu"

    # MiniMax Configuration
    MINIMAX_API_KEY: str = ""
    MINIMAX_TEXT_MODEL: str = "MiniMax-M2.5"
    MINIMAX_TTS_MODEL: str = "speech-2.8-hd"

    # Cantonese AI
    CANTONESE_API_KEY: str = ""

    # Exa (Web Search) Configuration
    EXA_API_KEY: str = ""

    # Firebase Configuration
    FIREBASE_CREDENTIALS_JSON_PATH: str = "firebase_key.json"

    # Database Configuration
    DATABASE_URL: str | None = None
    USE_IN_MEMORY_DB: bool = False
    DB_NAME: str = "database_dev.db"

    # Rate Limiting / Quota
    RATE_LIMIT_FREE_UNITS_BY_PLAN: dict[str, int] = {
        "free": 25,
        "pro": 100,
        "enterprise": 1000,
    }
    UNIT_COST_CHAT: int = 1
    UNIT_COST_INGESTION: int = 3
    UNIT_COST_RECOMMENDATIONS: int = 0
    UNIT_COST_SPEECH: int = 0
    UNIT_COST_UI: int = 1
    INGEST_MIN_UNITS: int = 3
    INGEST_WORDS_PER_UNIT: int = 1000
    UI_MIN_UNITS: int = 2
    UI_WORDS_PER_UNIT: int = 500
    MAX_DOC_UPLOAD_BYTES: int = 50 * 1024 * 1024
    MAX_AUDIO_UPLOAD_BYTES: int = 25 * 1024 * 1024

    # Application Settings
    DEBUG: bool = False
    PORT: int = 8000
    FAKE_LOGIN_TOKEN: str | None = "fake_demo_token_123"

    # JWT / Auth Settings
    JWT_SECRET_KEY: str = "CHANGE_ME_BEFORE_PRODUCTION"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # CORS Settings
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    model_config = SettingsConfigDict(
        env_file=f"{ROOT}/.env",
        env_file_encoding="utf-8",
        extra="allow"  # Allow extra fields from .env without explicit definition
    )

@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
