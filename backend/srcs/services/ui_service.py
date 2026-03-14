"""UIService — CRUD interface for MarkGraph scene documents.

Manages scene persistence.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from srcs.models.scene import Scene


# Default empty MarkGraph document
_EMPTY_MARKGRAPH: str = "# Root Scene\n"


class UIService:
    """Static methods for MarkGraph scene CRUD."""

    # -- Scene-level --------------------------------------------------------
    @staticmethod
    async def get_scene(db: AsyncSession, topic_id: str) -> Scene | None:
        """Return the scene pointed to by Topic.current_scene_id, or ``None``."""
        from srcs.models.topic import Topic
        
        result = await db.execute(
            select(Topic).where(Topic.topic_id == topic_id)
        )
        topic = result.scalar_one_or_none()
        if not topic or not topic.current_scene_id:
            return None

        result = await db.execute(
            select(Scene).where(Scene.scene_id == topic.current_scene_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_or_create_scene(db: AsyncSession, topic_id: str) -> Scene:
        """Return the current scene, creating a root one if it doesn't exist."""
        scene = await UIService.get_scene(db, topic_id)
        if scene is not None:
            return scene

        # New Topic or missing pointer: create root Scene
        scene = Scene(topic_id=topic_id, ui_markdown=_EMPTY_MARKGRAPH)
        db.add(scene)
        await db.flush()

        # Update Topic pointer
        from srcs.models.topic import Topic
        result = await db.execute(
            select(Topic).where(Topic.topic_id == topic_id)
        )
        topic = result.scalar_one_or_none()
        if topic:
            topic.current_scene_id = scene.scene_id

        await db.commit()
        return scene

    @staticmethod
    async def push_ui_version(
        db: AsyncSession, topic_id: str, ui_markdown: str
    ) -> Scene:
        """Push a NEW UI version. Points the topic's HEAD to it. Returns the new Scene."""
        from srcs.models.topic import Topic
        result = await db.execute(
            select(Topic).where(Topic.topic_id == topic_id)
        )
        topic = result.scalar_one_or_none()
        if not topic:
            raise ValueError(f"Topic {topic_id} not found")

        # Create new Scene branching from current
        new_scene = Scene(
            topic_id=topic_id,
            ui_markdown=ui_markdown,
            parent_scene_id=topic.current_scene_id
        )
        db.add(new_scene)
        await db.flush()

        # Move HEAD
        topic.current_scene_id = new_scene.scene_id
        await db.commit()
        return new_scene

    @staticmethod
    async def set_current_ui_to_version(
        db: AsyncSession, topic_id: str, scene_id: str
    ) -> None:
        """Set the Topic's current UI pointer to a specific historical scene_id."""
        from srcs.models.topic import Topic
        result = await db.execute(
            select(Topic).where(Topic.topic_id == topic_id)
        )
        topic = result.scalar_one_or_none()
        if not topic:
            raise ValueError(f"Topic {topic_id} not found")

        topic.current_scene_id = scene_id
        await db.commit()

    @staticmethod
    async def get_history(db: AsyncSession, topic_id: str):
        """Return a list of historical scene metadata for a topic."""
        import re
        from srcs.schemas.ui_dto import UIHistoryItem

        result = await db.execute(
            select(Scene)
            .where(Scene.topic_id == topic_id)
            .order_by(Scene.created_at.desc())
        )
        scenes = result.scalars().all()

        history = []
        for s in scenes:
            # Extract first heading as description
            description = "Untitled Scene"
            match = re.search(r"^#\s+(.+)$", s.ui_markdown, re.MULTILINE)
            if match:
                description = match.group(1).strip()
            
            history.append(UIHistoryItem(
                scene_id=s.scene_id,
                created_at=s.created_at,
                description=description
            ))

        return history

    @staticmethod
    async def create_share(db: AsyncSession, scene_id: str) -> str:
        """Create a public share record for a scene and return its share_id.
        
        If a share already exists for this scene, returns the existing share_id.
        """
        from srcs.models.share import Share
        
        # 1. Ensure the referenced Scene exists to avoid FK integrity errors
        scene_result = await db.execute(select(Scene).where(Scene.scene_id == scene_id))
        scene = scene_result.scalar_one_or_none()
        if scene is None:
            raise ValueError(f"Scene {scene_id} not found")
        
        # 2. Check if share already exists
        result = await db.execute(select(Share).where(Share.scene_id == scene_id))
        existing_share = result.scalar_one_or_none()
        if existing_share:
            return existing_share.share_id
            
        # 3. Create new Share record
        new_share = Share(scene_id=scene_id)
        db.add(new_share)
        await db.commit()
        await db.refresh(new_share)
        
        return new_share.share_id

    @staticmethod
    async def get_scene_by_share_id(db: AsyncSession, share_id: str) -> Scene | None:
        """Retrieve a scene via its public share_id."""
        from srcs.models.share import Share
        
        # Join Share and Scene
        result = await db.execute(
            select(Scene)
            .join(Share, Scene.scene_id == Share.scene_id)
            .where(Share.share_id == share_id)
        )
        return result.scalar_one_or_none()

    # -- Read helpers -------------------------------------------------------

    @staticmethod
    async def get_ui_markdown(db: AsyncSession, topic_id: str) -> str:
        """Return the full MarkGraph markdown for a topic, or an empty default."""
        scene = await UIService.get_scene(db, topic_id)
        if scene is None:
            return _EMPTY_MARKGRAPH
        return scene.ui_markdown

    # -- Mutating helpers ---------------------------------------------------

    @staticmethod
    async def replace_ui_markdown(
        db: AsyncSession, topic_id: str, ui_markdown: str,
    ) -> str:
        """DEPRECATED: Use push_ui_version instead. Legacy support for UIAgent compatibility."""
        scene = await UIService.push_ui_version(db, topic_id, ui_markdown)
        return scene.ui_markdown


if __name__ == "__main__":
    import asyncio

    async def _smoke():
        from srcs.database import engine, Base, AsyncSessionLocal

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with AsyncSessionLocal() as db:
            mg = await UIService.get_ui_markdown(db, "test_topic")
            print("Empty Markdown:", mg)

            mg = await UIService.replace_ui_markdown(db, "test_topic", "# Title\nHello")
            print("After replace:", mg)

    asyncio.run(_smoke())
