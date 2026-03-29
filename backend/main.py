"""UndefinedAI — Phase 1 POC backend entry-point."""
import os
import sqlite3
from asyncio import to_thread
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.engine import make_url

from srcs.config import get_settings
from srcs.database import SQLALCHEMY_DATABASE_URL, Base, engine

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


def _run_alembic_upgrade_head() -> None:
    alembic_cfg = Config(str(Path(__file__).resolve().parent / "alembic.ini"))
    command.upgrade(alembic_cfg, "head")


def _run_alembic_stamp(revision: str) -> None:
    alembic_cfg = Config(str(Path(__file__).resolve().parent / "alembic.ini"))
    command.stamp(alembic_cfg, revision)


def _get_sqlite_db_path() -> str | None:
    """Return the filesystem path for a file-backed SQLite DB, if any."""
    url = make_url(SQLALCHEMY_DATABASE_URL)
    db_path = url.database
    if not db_path or db_path.startswith("file:"):
        return None

    path = Path(db_path)
    return str(path)


def _sqlite_db_needs_baseline_stamp() -> bool:
    """Return True when a file-backed SQLite DB has tables but no Alembic versioning."""
    db_path = _get_sqlite_db_path()
    if not db_path or not os.path.exists(db_path):
        return False

    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
              AND name NOT LIKE 'sqlite_%'
            """
        )
        tables = {row[0] for row in cursor.fetchall()}
        return bool(tables) and "alembic_version" not in tables
    finally:
        conn.close()


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Hybrid bootstrap strategy:

    - **SQLite (local dev/test):** run ``alembic upgrade head`` so
      file-backed databases are versioned consistently across restarts.
    - **Postgres / Supabase:** ``create_all()`` is skipped.  Schema
      must be created by running ``alembic upgrade head`` before the
      app starts.  Alembic is the single source of truth for
      production schema.
    """
    if "sqlite" in SQLALCHEMY_DATABASE_URL:
        if settings.USE_IN_MEMORY_DB:
            # In-memory SQLite lifetime is tied to active connections, so Alembic's
            # separate engine can produce non-persistent schema. Build schema directly.
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
        else:
            if _sqlite_db_needs_baseline_stamp():
                # Older local DBs may have been created via create_all() and therefore
                # contain app tables but no alembic_version row yet.
                await to_thread(_run_alembic_stamp, "a001_baseline")
            await to_thread(_run_alembic_upgrade_head)
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
