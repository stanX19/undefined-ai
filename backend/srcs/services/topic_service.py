"""Topic service – CRUD + document text storage."""
import asyncio

from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from srcs.models.topic import Topic

_MAX_DB_RETRIES = 3
_RETRY_DELAY_SEC = 0.5


class TopicService:
    """Reusable topic operations."""

    @staticmethod
    async def create_topic(
        db: AsyncSession, user_id: str, title: str
    ) -> Topic:
        """Create a new topic for the given user."""
        topic = Topic(user_id=user_id, title=title)
        db.add(topic)
        await db.commit()
        await db.refresh(topic)
        return topic

    @staticmethod
    async def get_topic(db: AsyncSession, topic_id: str) -> Topic | None:
        """Fetch a single topic by ID."""
        result = await db.execute(
            select(Topic).where(Topic.topic_id == topic_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_user_topic(db: AsyncSession, topic_id: str, user_id: str) -> Topic | None:
        """Fetch a topic by ID only if it belongs to the given user.

        Returns None if the topic doesn't exist or belongs to another user.
        """
        result = await db.execute(
            select(Topic).where(Topic.topic_id == topic_id, Topic.user_id == user_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_user_topics(db: AsyncSession, user_id: str) -> list[Topic]:
        """List all topics belonging to a user, newest first."""
        result = await db.execute(
            select(Topic)
            .where(Topic.user_id == user_id)
            .order_by(Topic.created_at.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def set_document_text(
        db: AsyncSession, topic_id: str, text: str
    ) -> Topic:
        """Store extracted document text on a topic.

        Retries on OperationalError (e.g. database locked) to handle SQLite
        contention under concurrent load.

        Raises:
            ValueError: If the topic does not exist.
        """
        topic: Topic | None = await TopicService.get_topic(db, topic_id)
        if not topic:
            raise ValueError(f"Topic {topic_id} not found")

        for attempt in range(_MAX_DB_RETRIES):
            try:
                topic.document_text = text
                await db.commit()
                await db.refresh(topic)
                return topic
            except OperationalError as e:
                err_str = str(e).lower()
                if "locked" not in err_str and "busy" not in err_str:
                    raise
                if attempt == _MAX_DB_RETRIES - 1:
                    raise
                await db.rollback()
                topic = await TopicService.get_topic(db, topic_id)
                if not topic:
                    raise ValueError(f"Topic {topic_id} not found")
                await asyncio.sleep(_RETRY_DELAY_SEC * (attempt + 1))

        return topic

    @staticmethod
    async def delete_user_topic(db: AsyncSession, topic_id: str, user_id: str) -> bool:
        """Delete a topic owned by a user. Returns True if deleted, False if not found or unauthorized."""
        result = await db.execute(
            select(Topic).where(Topic.topic_id == topic_id, Topic.user_id == user_id)
        )
        topic = result.scalar_one_or_none()

        if not topic:
            return False

        await db.delete(topic)
        await db.commit()
        return True
