"""UIService — CRUD interface for A2UI scene documents.

Manages scene persistence, element-level CRUD, and patch application.
All mutating methods return the updated full ``ui_json``.
"""
import copy
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from srcs.models.scene import Scene


# Default empty A2UI document
_EMPTY_UI: dict = {
    "version": "3.0",
    "root_id": "root",
    "elements": {},
}


class UIService:
    """Static methods for scene + element CRUD."""

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

        scene = Scene(topic_id=topic_id, ui_json=copy.deepcopy(_EMPTY_UI))
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
    async def get_ui_json(db: AsyncSession, topic_id: str) -> dict:
        """Return the full A2UI JSON for a topic, or an empty default."""
        scene = await UIService.get_scene(db, topic_id)
        if scene is None:
            return copy.deepcopy(_EMPTY_UI)
        return scene.ui_json

    @staticmethod
    async def get_element(
        db: AsyncSession, topic_id: str, element_id: str,
    ) -> dict | None:
        """Return a single element by ID, or ``None``."""
        ui = await UIService.get_ui_json(db, topic_id)
        return ui.get("elements", {}).get(element_id)

    @staticmethod
    async def list_elements(
        db: AsyncSession, topic_id: str,
    ) -> list[dict]:
        """Return a list of ``{id, type}`` dicts for all elements."""
        ui = await UIService.get_ui_json(db, topic_id)
        elements = ui.get("elements", {})
        return [
            {"id": eid, "type": data.get("type", "unknown")}
            for eid, data in elements.items()
        ]

    # -- Mutating helpers ---------------------------------------------------

    @staticmethod
    async def set_element(
        db: AsyncSession, topic_id: str, element_id: str, element_data: dict,
    ) -> dict:
        """Add or overwrite a single element. Returns updated ``ui_json``."""
        scene = await UIService.get_or_create_scene(db, topic_id)
        ui = copy.deepcopy(scene.ui_json)
        ui.setdefault("elements", {})[element_id] = element_data
        scene.ui_json = ui
        await UIService.save_scene(db, scene)
        return ui

    @staticmethod
    async def remove_element(
        db: AsyncSession, topic_id: str, element_id: str,
    ) -> dict:
        """Remove an element by ID. Returns updated ``ui_json``."""
        scene = await UIService.get_or_create_scene(db, topic_id)
        ui = copy.deepcopy(scene.ui_json)
        ui.get("elements", {}).pop(element_id, None)
        scene.ui_json = ui
        await UIService.save_scene(db, scene)
        return ui

    @staticmethod
    async def set_root_id(
        db: AsyncSession, topic_id: str, root_id: str,
    ) -> dict:
        """Set the root_id of the UI document. Returns updated ``ui_json``."""
        scene = await UIService.get_or_create_scene(db, topic_id)
        ui = copy.deepcopy(scene.ui_json)
        ui["root_id"] = root_id
        scene.ui_json = ui
        await UIService.save_scene(db, scene)
        return ui

    @staticmethod
    async def replace_ui_json(
        db: AsyncSession, topic_id: str, ui_json: dict,
    ) -> dict:
        """Replace the entire UI document wholesale. Returns the new ``ui_json``."""
        scene = await UIService.get_or_create_scene(db, topic_id)
        scene.ui_json = copy.deepcopy(ui_json)
        await UIService.save_scene(db, scene)
        return scene.ui_json

    @staticmethod
    async def apply_patches(
        db: AsyncSession, topic_id: str, patches: list[dict],
    ) -> dict:
        """Apply a list of patch operations. Returns updated ``ui_json``.

        Each patch: ``{"op": "add"|"remove"|"update", "target_id": "...", "patch_data": {...}}``
        """
        scene = await UIService.get_or_create_scene(db, topic_id)
        ui = copy.deepcopy(scene.ui_json)
        elements = ui.setdefault("elements", {})

        for patch in patches:
            op = patch.get("op")
            target = patch.get("target_id")
            data = patch.get("patch_data", {})

            if not target:
                continue

            if op == "add":
                elements[target] = data
            elif op == "remove":
                elements.pop(target, None)
            elif op == "update":
                if target in elements:
                    elements[target].update(data)

        scene.ui_json = ui
        await UIService.save_scene(db, scene)
        return ui


if __name__ == "__main__":
    import asyncio

    async def _smoke():
        from srcs.database import engine, Base, AsyncSessionLocal

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with AsyncSessionLocal() as db:
            ui = await UIService.get_ui_json(db, "test_topic")
            print("Empty UI:", ui)

            ui = await UIService.set_element(db, "test_topic", "root", {
                "type": "linear_layout", "orientation": "vertical", "children": []
            })
            print("After set_element:", ui)

            items = await UIService.list_elements(db, "test_topic")
            print("Elements:", items)

    asyncio.run(_smoke())
