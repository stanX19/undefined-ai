"""Chat service – message persistence and history retrieval."""
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from srcs.models.chat_message import ChatMessage


class ChatService:
    """Reusable chat-history operations."""

    @staticmethod
    async def add_message(
        db: AsyncSession, topic_id: str, role: str, message: str
    ) -> ChatMessage:
        """Persist a single chat message."""
        msg = ChatMessage(topic_id=topic_id, role=role, message=message)
        db.add(msg)
        await db.commit()
        await db.refresh(msg)
        return msg

    @staticmethod
    async def get_history(
        db: AsyncSession, topic_id: str, limit: int = 50
    ) -> list[ChatMessage]:
        """Return chat history for a topic, oldest-first, capped by *limit*."""
        result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.topic_id == topic_id)
            .order_by(ChatMessage.created_at.asc())
            .limit(limit)
        )
        return list(result.scalars().all())

    @staticmethod
    async def clear_history(db: AsyncSession, topic_id: str) -> int:
        """Delete all messages for a topic. Returns number of deleted rows."""
        result = await db.execute(
            delete(ChatMessage).where(ChatMessage.topic_id == topic_id)
        )
        await db.commit()
        return result.rowcount  # type: ignore[return-value]
