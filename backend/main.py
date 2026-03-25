"""UndefinedAI — Phase 1 POC backend entry-point."""
import os
from asyncio import to_thread
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from srcs.config import get_settings
from srcs.database import engine, Base, SQLALCHEMY_DATABASE_URL

# Import models so Base.metadata knows about every table
import srcs.models  # noqa: F401

# Route modules
from srcs.routes.health import router as health_router
from srcs.routes.auth import router as auth_router, limiter
from srcs.routes.topics import router as topics_router
from srcs.routes.chat import router as chat_router
from srcs.routes.ingestion import router as ingestion_router
from srcs.routes.recommendations import router as recommendations_router
from srcs.routes.speech import router as speech_router
from srcs.routes.ui import router as ui_router


def _sqlite_db_exists() -> bool:
    if "sqlite" not in SQLALCHEMY_DATABASE_URL or ":memory:" in SQLALCHEMY_DATABASE_URL or "mode=memory" in SQLALCHEMY_DATABASE_URL:
        return False
    prefix = "sqlite+aiosqlite:///"
    if not SQLALCHEMY_DATABASE_URL.startswith(prefix):
        return False
    db_path = SQLALCHEMY_DATABASE_URL[len(prefix):]
    return os.path.exists(db_path)


def _run_alembic_upgrade_head() -> None:
    alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "alembic.ini"))
    command.upgrade(alembic_cfg, "head")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Hybrid bootstrap strategy:

    - **SQLite (local dev/test):** ``create_all()`` builds the full
      schema from ORM metadata so you can boot without running Alembic
      first.  This is intentional for throwaway local databases.
    - **Postgres / Supabase:** ``create_all()`` is skipped.  Schema
      must be created by running ``alembic upgrade head`` before the
      app starts.  Alembic is the single source of truth for
      production schema.
    """
    if "sqlite" in SQLALCHEMY_DATABASE_URL:
        if _sqlite_db_exists():
            await to_thread(_run_alembic_upgrade_head)
        else:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
    yield


settings = get_settings()

app: FastAPI = FastAPI(
    title="UndefinedAI",
    version="0.1.0",
    lifespan=lifespan,
    debug=settings.DEBUG,
)

# -- CORS ---------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -- Rate Limiter (slowapi) ---------------------------------------------------
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# -- Routers ------------------------------------------------------------------
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(topics_router)
app.include_router(chat_router)
app.include_router(ingestion_router)
app.include_router(recommendations_router)
app.include_router(speech_router)
app.include_router(ui_router)

# -- Static files (uploaded PDFs) ---------------------------------------------
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=True)
