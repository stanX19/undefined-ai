import asyncio
import json
import os

from tests.test_client import Colors

# Lazy imports inside async functions to avoid heavy imports at module load.

async def _ensure_user(user_id: str) -> None:
    """Create a dummy user if it does not exist."""
    from srcs.database import AsyncSessionLocal, Base, engine
    from srcs.models.user import User  # noqa: F401 – registers model

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        from sqlalchemy import select
        existing = (await db.execute(select(User).where(User.user_id == user_id))).scalar_one_or_none()
        if existing:
            return
        db.add(User(
            user_id=user_id,
            email=f"{user_id}@test.com",
            password_hash="mock_hash"
        ))
        await db.commit()


async def _ensure_topic(topic_id: str, user_id: str) -> None:
    """Create a dummy topic linked to the given user if it does not exist."""
    from srcs.database import AsyncSessionLocal, Base, engine
    from srcs.models.topic import Topic  # noqa: F401 – registers model

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        from sqlalchemy import select
        existing = (await db.execute(select(Topic).where(Topic.topic_id == topic_id))).scalar_one_or_none()
        if existing:
            return
        db.add(Topic(topic_id=topic_id, user_id=user_id, title="UI Agent Direct Test"))
        await db.commit()


async def run_ui_test() -> None:
    from srcs.services.agents.ui_agent import ui_agent

    user_id = "direct_ui_test_user"
    topic_id = "direct_ui_test_topic"
    await _ensure_user(user_id)
    await _ensure_topic(topic_id, user_id)

    print(f"\n{Colors.GREEN}{Colors.BOLD}--- Direct UI Agent Chat ---{Colors.END}")
    print(f"Topic ID: {topic_id}")
    print("Type a prompt to send directly to the UI Agent.")
    print("Type 'exit' or 'quit' to stop.\n")

    while True:
        try:
            user_msg = input(f"{Colors.BLUE}{Colors.BOLD}You: {Colors.END}")
        except (EOFError, KeyboardInterrupt):
            break

        if user_msg.lower() in ("exit", "quit", "q"):
            print("Exiting UI test...")
            break

        if not user_msg.strip():
            continue

        print(f"{Colors.YELLOW}Calling UIAgent.edit() ...{Colors.END}")
        result = await ui_agent.edit(topic_id, user_msg)

        # Guard clause for errors
        if "error" in result:
            print(f"{Colors.RED}Error: {result['error']}{Colors.END}\n")
            continue

        # Raw MarkGraph
        raw_mg = result.get("ui_markdown", "")
        print(f"\n{Colors.CYAN}--- Raw MarkGraph ---{Colors.END}")
        print(raw_mg)

        # Parsed JSON AST
        ui_json = result.get("ui_json", {})
        print(f"\n{Colors.CYAN}--- Parsed JSON ---{Colors.END}")
        print(json.dumps(ui_json, indent=2))
        print()


if __name__ == "__main__":
    asyncio.run(run_ui_test())
