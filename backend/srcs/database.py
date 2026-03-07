from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from typing import AsyncGenerator

# Use aiosqlite driver for async SQLite
from srcs.config import get_settings

settings = get_settings()

if settings.USE_IN_MEMORY_DB:
    SQLALCHEMY_DATABASE_URL = "sqlite+aiosqlite:///file:memdb?mode=memory&cache=shared&uri=true"
else:
    SQLALCHEMY_DATABASE_URL = f"sqlite+aiosqlite:///./{settings.DB_NAME}"


engine = create_async_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},  # Needed for SQLite
    echo=settings.DEBUG
)

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
