"""UndefinedAI — Phase 1 POC backend entry-point."""
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from srcs.config import get_settings
from srcs.database import engine, Base

# Import models so Base.metadata knows about every table
import srcs.models  # noqa: F401

# Route modules
from srcs.routes.health import router as health_router
from srcs.routes.auth import router as auth_router
from srcs.routes.topics import router as topics_router
from srcs.routes.chat import router as chat_router
from srcs.routes.ingestion import router as ingestion_router


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Create DB tables on startup (no Alembic for POC)."""
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

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(topics_router)
app.include_router(chat_router)
app.include_router(ingestion_router)

# ── Static files (uploaded PDFs) ─────────────────────────────────────────────
import os

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=True)