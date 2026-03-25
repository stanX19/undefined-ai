from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import AsyncAdaptedQueuePool
from typing import AsyncGenerator
import logging

from srcs.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

if settings.DATABASE_URL:
    SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL
elif settings.USE_IN_MEMORY_DB:
    SQLALCHEMY_DATABASE_URL = "sqlite+aiosqlite:///file:memdb?mode=memory&cache=shared&uri=true"
else:
    SQLALCHEMY_DATABASE_URL = f"sqlite+aiosqlite:///./{settings.DB_NAME}"

_is_sqlite = "sqlite" in SQLALCHEMY_DATABASE_URL

if _is_sqlite:
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
else:
    engine = create_async_engine(
        SQLALCHEMY_DATABASE_URL,
        echo=False,
    )


if _is_sqlite:
    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, connection_record):
        """Run PRAGMAs on each new connection to improve concurrency."""
        try:
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA busy_timeout=30000")
            if not settings.USE_IN_MEMORY_DB:
                cursor.execute("PRAGMA journal_mode=WAL")
                cursor.execute("PRAGMA synchronous=NORMAL")

            cursor.execute("PRAGMA journal_mode")
            jm = cursor.fetchone()[0]
            cursor.execute("PRAGMA busy_timeout")
            bt = cursor.fetchone()[0]
            if settings.DEBUG:
                logger.debug("SQLite connection initialized: journal_mode=%s, busy_timeout=%s", jm, bt)

            cursor.close()
        except Exception as e:
            logger.exception("Error setting SQLite PRAGMAs: %s", e)


AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting async session."""
    async with AsyncSessionLocal() as session:
        yield session
