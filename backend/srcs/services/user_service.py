"""User service – handles user lookup and creation."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from srcs.models.user import User


class UserService:
    """Reusable user operations."""

    @staticmethod
    async def get_user(db: AsyncSession, user_id: str) -> User | None:
        """Return a user by ID, or ``None`` if not found."""
        result = await db.execute(select(User).where(User.user_id == user_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_or_create_user(db: AsyncSession, user_id: str) -> User:
        """Return existing user or create a new one with the given ID."""
        existing: User | None = await UserService.get_user(db, user_id)
        if existing:
            return existing

        user = User(user_id=user_id)
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user
