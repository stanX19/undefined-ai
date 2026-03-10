"""Agent tools — callable by the LangGraph ReAct agent."""
from langchain_core.tools import tool

from srcs.services.retrieval_service import RetrievalService
from srcs.services.web_search_service import WebSearchService, WebSearchNotAvailableException
from srcs.services.agents.id_mapper import current_mapper


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

    mapper = current_mapper()
    topic_id = mapper.resolve(topic_id)
    fact_id = mapper.resolve(fact_id)

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

    mapper = current_mapper()
    topic_id = mapper.resolve(topic_id)

    async with AsyncSessionLocal() as db:
        facts = await RetrievalService.get_facts_by_level(db, topic_id, level)

    if not facts:
        return f"No level-{level} facts found for this topic."

    lines: list[str] = [f"=== {len(facts)} level-{level} facts ==="]
    for f in facts:
        short_fid = mapper.shorten(f.fact_id, prefix="F")
        lines.append(f"[{short_fid}] {f.content}")

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
    try:
        results = await WebSearchService.search(query, num_results=5)
    except WebSearchNotAvailableException as e:
        return str(e)

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
    topic_id = current_mapper().resolve(topic_id)

    content = await WebSearchService.get_web_content(url)

    if not content or len(content.strip()) < 50:
        return f"Could not fetch meaningful content from {url}."

    from srcs.services.ingestion_service import IngestionService
    IngestionService.trigger_ingestion(topic_id, content)

    return (
        f"Ingestion started for content from {url} ({len(content)} chars). "
        f"The knowledge base will be updated shortly with a new knowledge tree. This takes some time"
    )


@tool
async def edit_ui(topic_id: str, description: str, header_name: str | None = None, fact_ids: list[str] | None = None) -> str:
    """Design or edit the UI surface for a topic.

    This delegates to a specialised UIAgent that reads the current MarkGraph UI state,
    and returns a newly generated MarkGraph UI document.

    If you have any specific facts in mind, pass their IDs in the `fact_ids`
    parameter instead of including them in the `description`.

    Args:
        topic_id: The topic whose UI to edit.
        description: Natural language description of the desired UI changes.
        header_name: Optional name or ID of the container/scene to edit. If provided, ONLY that specific container/scene section will be edited.
        fact_ids: Optional list of fact IDs. The text of these facts will be automatically retrieved and provided to the UIAgent.

    Returns:
        Confirmation with a brief summary of changes.
    """
    from srcs.services.agents.ui_agent import ui_agent
    from srcs.services.sse_service import SseService
    from srcs.schemas.ui_dto import SseUIUpdateData
    from srcs.database import AsyncSessionLocal

    mapper = current_mapper()
    topic_id = mapper.resolve(topic_id)
    
    # Append fact contents to description if fact_ids are provided
    if fact_ids:
        try:
            resolved_fact_ids: list[str] = [mapper.resolve(fid) for fid in fact_ids]
            async with AsyncSessionLocal() as db:
                facts = await RetrievalService.get_facts_by_ids(db, resolved_fact_ids)
            
            if facts:
                fact_texts = [f"- [{mapper.shorten(f.fact_id, prefix='F')}] {f.content}" for f in facts]
                description += "\n\nFacts to include:\n" + "\n".join(fact_texts)
        except Exception as exc:
            import traceback
            traceback.print_exc()
            return f"UI editing failed during fact retrieval: {exc}"

    # ui_agent.edit returns {"ui_json": {...}, "ui_markdown": "..."} or {"error": "..."}
    result = await ui_agent.edit(topic_id, description, header_name)

    if "error" in result:
        return f"UI editing failed: {result['error']}"

    ui_json = result["ui_json"]

    # Read the scene_id so we can include it in the SSE event
    from srcs.database import AsyncSessionLocal
    from srcs.services.ui_service import UIService

    async with AsyncSessionLocal() as db:
        scene = await UIService.get_scene(db, topic_id)
        scene_id = scene.scene_id if scene else "unknown"

    session_id = topic_id  # Phase 1: topic_id == SSE session_id
    await SseService.emit(
        session_id,
        SseUIUpdateData(
            topic_id=topic_id,
            scene_id=scene_id,
            ui_json=ui_json,
            ui_markdown=result["ui_markdown"],
        ),
    )

    # In MarkGraph, element count is scenes/containers/elements, roughly sum of all nodes
    scene_cnt = len(ui_json.get("scenes", []))
    return (
        f"UI updated successfully. "
        f"The scene now has {scene_cnt} root container(s) "
        f"and has been pushed to the frontend."
    )


if __name__ == "__main__":
    print("Tools module loaded OK")
    tools = [retrieve_facts, list_topic_facts, search_web, ingest_url, edit_ui]
    for t in tools:
        print(f"  {t.name}: {t.description[:60]}...")
