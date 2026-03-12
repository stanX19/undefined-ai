"""User service — handles user lookup, creation, and authentication."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from srcs.models.user import User
from srcs.utils.auth_utils import hash_password, verify_password


class UserService:
    """Reusable user operations."""

    @staticmethod
    async def get_user(db: AsyncSession, user_id: str) -> User | None:
        """Return a user by ID, or ``None`` if not found."""
        result = await db.execute(select(User).where(User.user_id == user_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
        """Return a user by email, or ``None`` if not found."""
        result = await db.execute(
            select(User).where(User.email == email.strip().lower())
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def create_user(
        db: AsyncSession,
        email: str,
        password: str,
        education_level: str | None = None,
    ) -> User:
        """Create a new user with a hashed password."""
        user = User(
            email=email.strip().lower(),
            password_hash=hash_password(password),
            education_level=education_level,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def authenticate_user(
        db: AsyncSession,
        email: str,
        password: str,
    ) -> User | None:
        """Verify credentials. Return user if valid, ``None`` otherwise."""
        user = await UserService.get_user_by_email(db, email)
        if not user:
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user

    @staticmethod
    async def update_education_level(
        db: AsyncSession,
        user: "User",
        education_level: str,
    ) -> "User":
        """Update a user's education level in the database."""
        user.education_level = education_level
        await db.commit()
        await db.refresh(user)
        return user
