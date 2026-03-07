"""API dependencies."""
from fastapi import Header, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import traceback

from srcs.database import get_db
from srcs.models.user import User
from srcs.services.user_service import UserService

async def get_current_user(
    x_user_id: str | None = Header(None, alias="X-User-Id"),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get the current user from the X-User-Id header, creating them if they don't exist."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="X-User-Id header missing")
    
    try:
        user = await UserService.get_or_create_user(db, x_user_id)
        return user
    except Exception as exc:
        print("Error getting or creating user:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error")
