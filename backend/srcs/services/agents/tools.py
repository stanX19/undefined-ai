"""Agent tools — callable by the LangGraph ReAct agent."""
from langchain_core.tools import tool

from srcs.services.retrieval_service import RetrievalService
from srcs.services.web_search_service import WebSearchService


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
        0 = raw document text
        1 = atomic facts (extracted from document)
        2+ = progressively compressed summaries (higher = more condensed)
        N (max) = highest-level summary (the max level is provided in context)

    Use level 1 for detailed facts, higher levels for broader summaries.
    The maximum available level is provided in the document context.

    Args:
        topic_id: The topic to list facts for.
        level: The compression level (0 to max_level shown in context).

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


@tool
async def search_web(query: str) -> str:
    """Search the web and return a brief summary of results with links.

    Use this when the user asks about something NOT covered by the document,
    or wants current / external information. Returns only titles, URLs, and
    publication dates — no full-page content.

    Args:
        query: The search query string.

    Returns:
        A concise list of search results the user (or you) can act on.
    """
    results = await WebSearchService.search(query, num_results=5)

    if not results:
        return "No web results found for this query."

    lines: list[str] = [f"=== Web Search Results for: '{query}' ==="]
    for i, r in enumerate(results, 1):
        lines.append(f"\n{i}. {r.metadata.title}")
        lines.append(f"   URL: {r.url}")
        if r.metadata.published_date:
            lines.append(f"   Published: {r.metadata.published_date}")

    lines.append(
        "\nUse ingest_url with a URL above to add its content "
        "to the topic's knowledge base for deeper analysis."
    )
    return "\n".join(lines)


@tool
async def ingest_url(topic_id: str, url: str) -> str:
    """Fetch a web page and ingest its content into the topic's knowledge base.

    This creates a NEW knowledge tree alongside existing document data
    (nothing is deleted). After ingestion the new content is available at
    all hierarchy levels via list_topic_facts / retrieve_facts.

    Args:
        topic_id: The topic to add the web content to.
        url: The URL to fetch and ingest.

    Returns:
        Confirmation that ingestion has started.
    """
    content = await WebSearchService.get_web_content(url)

    if not content or len(content.strip()) < 50:
        return f"Could not fetch meaningful content from {url}."

    from srcs.services.ingestion_service import IngestionService
    IngestionService.trigger_ingestion(topic_id, content)

    return (
        f"Ingestion started for content from {url} ({len(content)} chars). "
        f"The knowledge base will be updated shortly with a new knowledge tree."
    )


@tool
async def design_ui(description: str) -> str:
    """Design and render a custom UI surface for the user.

    This tool is not yet implemented. It will allow creating interactive
    UI components based on a natural language description.

    Args:
        description: A natural language description of the desired UI.

    Returns:
        Status message.
    """
    return "The UI design tool is not yet available. This feature is coming soon."
