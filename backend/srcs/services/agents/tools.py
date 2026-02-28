"""Agent tools — callable by the LangGraph ReAct agent."""
from langchain_core.tools import tool

from srcs.services.retrieval_service import RetrievalService


@tool
def toggle_ui(enabled: bool) -> str:
    """Toggle the UI visibility.

    Args:
        enabled: ``True`` to show the UI, ``False`` to hide it.

    Returns:
        A confirmation string.
    """
    return "Success"


@tool
async def retrieve_facts(topic_id: str, fact_id: str) -> str:
    """Retrieve a fact and its full parent chain from the knowledge hierarchy.

    Use this tool to drill deeper into a topic's knowledge base.
    Given a fact_id, returns the fact content plus all its parent facts
    up to the root, and the original source text chunk.

    Args:
        topic_id: The topic this fact belongs to.
        fact_id: The ID of the fact to retrieve.

    Returns:
        A formatted string with the fact, its parent chain, and source text.
    """
    from srcs.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        result = await RetrievalService.get_fact_with_parents(db, fact_id)

    if not result:
        return f"No fact found with id '{fact_id}'."

    lines: list[str] = [
        f"=== Fact (level {result.fact.level}) ===",
        result.fact.content,
    ]

    if result.parents:
        lines.append("\n=== Parent chain (→ root) ===")
        for parent in result.parents:
            lines.append(f"[Level {parent.level}] {parent.content}")

    if result.source_chunk:
        lines.append("\n=== Original source text ===")
        lines.append(result.source_chunk.content)

    return "\n".join(lines)


@tool
async def list_topic_facts(topic_id: str, level: int) -> str:
    """List all facts for a topic at a specific compression level.

    Levels:
        0 = raw text chunks
        1 = atomic facts (extracted from chunks)
        2 = main facts (first compression)
        3 = core concepts (highest level summary)

    Args:
        topic_id: The topic to list facts for.
        level: The compression level (0-3).

    Returns:
        A formatted list of facts at the requested level.
    """
    from srcs.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        facts = await RetrievalService.get_facts_by_level(db, topic_id, level)

    if not facts:
        return f"No level-{level} facts found for this topic."

    lines: list[str] = [f"=== {len(facts)} level-{level} facts ==="]
    for f in facts:
        lines.append(f"[{f.fact_id}] {f.content}")

    return "\n".join(lines)
