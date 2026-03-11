from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import AsyncAdaptedQueuePool
from typing import AsyncGenerator

from srcs.config import get_settings

settings = get_settings()

if settings.USE_IN_MEMORY_DB:
    SQLALCHEMY_DATABASE_URL = "sqlite+aiosqlite:///file:memdb?mode=memory&cache=shared&uri=true"
else:
    SQLALCHEMY_DATABASE_URL = f"sqlite+aiosqlite:///./{settings.DB_NAME}"

# SQLite config: timeout (seconds) + busy_timeout (ms) to wait for locks instead of failing immediately.
# Reduces "database table is locked" under concurrent load (e.g. upload + ingestion + multiple API calls).
_CONNECT_ARGS = {
    "check_same_thread": False,
    "timeout": 30,
}

engine = create_async_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args=_CONNECT_ARGS,
    poolclass=AsyncAdaptedQueuePool,
    pool_size=5,
    max_overflow=10,
    echo=False,
)


@event.listens_for(engine.sync_engine, "connect")
def _set_sqlite_pragma(dbapi_conn, connection_record):
    """Run PRAGMAs on each new connection to improve concurrency.
    aiosqlite wraps sqlite3; we use the raw connection when available.
    """
    raw = getattr(dbapi_conn, "_connection", dbapi_conn)
    try:
        cursor = raw.cursor()
        cursor.execute("PRAGMA busy_timeout=30000")  # 30s wait for lock (ms)
        if not settings.USE_IN_MEMORY_DB:
            cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()
    except Exception:
        pass  # timeout in connect_args still applies

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

class Base(DeclarativeBase):
    pass

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting async session."""
    async with AsyncSessionLocal() as session:
        yield session
