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
        """Return the latest scene for *topic_id*, or ``None``."""
        result = await db.execute(
            select(Scene)
            .where(Scene.topic_id == topic_id)
            .order_by(Scene.created_at.desc())
            .limit(1)
        )
        return result.scalars().first()

    @staticmethod
    async def get_or_create_scene(db: AsyncSession, topic_id: str) -> Scene:
        """Return the latest scene, creating an empty one if none exists."""
        scene = await UIService.get_scene(db, topic_id)
        if scene is not None:
            return scene

        scene = Scene(topic_id=topic_id, ui_markdown=_EMPTY_MARKGRAPH)
        db.add(scene)
        await db.flush()
        await db.commit()
        return scene

    @staticmethod
    async def save_scene(db: AsyncSession, scene: Scene) -> Scene:
        """Persist changes to a scene."""
        db.add(scene)
        await db.flush()
        await db.commit()
        return scene

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
        """Replace the entire UI document wholesale. Returns the new markdown."""
        scene = await UIService.get_or_create_scene(db, topic_id)
        scene.ui_markdown = ui_markdown
        await UIService.save_scene(db, scene)
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
