"""UIAgent — LangGraph ReAct agent specialised for A2UI editing.

Uses the rotating LLM pool and has tools for element CRUD + knowledge retrieval.
Called by the ``edit_ui`` chatbot tool.
"""
import json
import traceback

from langchain_core.messages import HumanMessage, SystemMessage, BaseMessage
from langchain_core.tools import tool
from langchain.agents import create_agent

from srcs.services.agents.rotating_llm import rotating_llm
from srcs.services.agents.prompts.ui_agent import UI_AGENT_PROMPT
from srcs.services.agents.id_mapper import current_mapper


# ---------------------------------------------------------------------------
# UIAgent-specific tools — each creates its own DB session to stay stateless
# ---------------------------------------------------------------------------


@tool
async def set_element(topic_id: str, element_id: str, element_json: str) -> str:
    """Add or overwrite a single UI element.

    The element_json must be a valid JSON string matching an A2UI element schema.
    Use hierarchical IDs like "root", "root.header", "root.body.graph1".

    Args:
        topic_id: The topic to edit.
        element_id: The element ID (hierarchical dot notation).
        element_json: A JSON string with the element data (must include "type").

    Returns:
        Confirmation with the element ID.
    """
    from srcs.database import AsyncSessionLocal
    from srcs.services.ui_service import UIService

    topic_id = current_mapper().resolve(topic_id)

    try:
        data = json.loads(element_json)
    except json.JSONDecodeError as e:
        return f"Invalid JSON: {e}"

    if "type" not in data:
        return "Error: element_json must include a 'type' field."

    async with AsyncSessionLocal() as db:
        await UIService.set_element(db, topic_id, element_id, data)
    return f"Element '{element_id}' set successfully."


@tool
async def remove_element(topic_id: str, element_id: str) -> str:
    """Remove a single UI element by ID.

    Args:
        topic_id: The topic to edit.
        element_id: The element ID to remove.

    Returns:
        Confirmation message.
    """
    from srcs.database import AsyncSessionLocal
    from srcs.services.ui_service import UIService

    topic_id = current_mapper().resolve(topic_id)

    async with AsyncSessionLocal() as db:
        await UIService.remove_element(db, topic_id, element_id)
    return f"Element '{element_id}' removed."


@tool
async def append_ui(topic_id: str, elements_json: str) -> str:
    """Appends multiple UI elements directly into the UI document.

    Use this when you need to add many elements (like table cells or graph nodes)
    to an existing UI without redefining the entire document. It merges the given
    elements into the scene's elements dictionary.

    Args:
        topic_id: The topic whose UI to update.
        elements_json: A JSON string containing a dictionary of element IDs mapped 
                       to their element data. Example:
                       {"root.cell1": {"type": "text", "content": "1"}, "root.cell2": ...}

    Returns:
        Confirmation with appended element count.
    """
    from srcs.database import AsyncSessionLocal
    from srcs.services.ui_service import UIService

    topic_id = current_mapper().resolve(topic_id)

    try:
        elements = json.loads(elements_json)
    except json.JSONDecodeError as e:
        return f"Invalid JSON: {e}"

    if not isinstance(elements, dict):
        return "Error: elements_json must be a JSON dictionary of { element_id: data }."

    for eid, data in elements.items():
        if not isinstance(data, dict) or "type" not in data:
            return f"Error: Element '{eid}' must be an object with a 'type' field."

    async with AsyncSessionLocal() as db:
        await UIService.append_elements(db, topic_id, elements)

    return f"Successfully appended {len(elements)} element(s)."


@tool
async def set_root_id(topic_id: str, root_id: str) -> str:
    """Set the root_id of the UI document (the entry element to render first).

    Args:
        topic_id: The topic to edit.
        root_id: The element ID to use as root.

    Returns:
        Confirmation message.
    """
    from srcs.database import AsyncSessionLocal
    from srcs.services.ui_service import UIService

    topic_id = current_mapper().resolve(topic_id)

    async with AsyncSessionLocal() as db:
        await UIService.set_root_id(db, topic_id, root_id)
    return f"Root ID set to '{root_id}'."


@tool
async def replace_ui(topic_id: str, ui_json_str: str) -> str:
    """Replace the entire UI document with a new A2UI v3.0 JSON.

    Use this when creating a NEW UI from scratch — it is far more efficient
    than calling set_element many times.  For small edits to an existing UI,
    prefer set_element / remove_element instead.

    The JSON must be a complete A2UI v3.0 document with "version", "root_id",
    and "elements" keys.

    Args:
        topic_id: The topic whose UI to replace.
        ui_json_str: The full A2UI JSON document as a string.

    Returns:
        Confirmation with element count.
    """
    from srcs.database import AsyncSessionLocal
    from srcs.services.ui_service import UIService

    topic_id = current_mapper().resolve(topic_id)

    try:
        ui_json = json.loads(ui_json_str)
    except json.JSONDecodeError as e:
        return f"Invalid JSON: {e}"

    if "elements" not in ui_json:
        return "Error: ui_json must include an 'elements' key."
    if "root_id" not in ui_json:
        return "Error: ui_json must include a 'root_id' key."

    ui_json.setdefault("version", "3.0")

    async with AsyncSessionLocal() as db:
        await UIService.replace_ui_json(db, topic_id, ui_json)

    count = len(ui_json.get("elements", {}))
    return f"UI replaced successfully with {count} element(s)."


# ---------------------------------------------------------------------------
# UIAgent class
# ---------------------------------------------------------------------------

# Reuse knowledge tools from the main chatbot's tool set
from srcs.services.agents.tools import retrieve_facts, list_topic_facts


class UIAgent:
    """LangGraph ReAct agent for A2UI protocol editing.

    Instantiate once and reuse.
    """

    def __init__(self) -> None:
        self.tools = [
            replace_ui, append_ui,
            set_element, remove_element, set_root_id,
            retrieve_facts, list_topic_facts,
        ]
        self.system_prompt = UI_AGENT_PROMPT

    async def edit(self, topic_id: str, prompt: str) -> dict:
        """Run the agent to edit the UI for *topic_id* per *prompt*.

        Returns the final ``ui_json`` after all edits.
        """
        # Fetch current UI so the agent doesn't waste a tool call
        from srcs.database import AsyncSessionLocal
        from srcs.services.ui_service import UIService

        async with AsyncSessionLocal() as db:
            current_ui = await UIService.get_ui_json(db, topic_id)

        current_ui_str = json.dumps(current_ui, indent=2)

        messages: list[BaseMessage] = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=(
                f"Topic ID: {current_mapper().shorten(topic_id, prefix='T')}\n\n"
                f"--- CURRENT UI STATE ---\n{current_ui_str}\n--- END UI STATE ---\n\n"
                f"Instruction: {prompt}"
            )),
        ]

        try:
            llm = await rotating_llm.get_runnable(temperature=0.3)
            agent = create_agent(model=llm, tools=self.tools)
            await agent.ainvoke(
				{"messages": messages},
				config={"recursion_limit": 50}
			)

            # After the agent has finished calling tools, read back the final state
            async with AsyncSessionLocal() as db:
                return await UIService.get_ui_json(db, topic_id)

        except Exception as exc:
            traceback.print_exc()
            return {"error": str(exc)}


# -- Module-level singleton ---------------------------------------------------
ui_agent = UIAgent()


if __name__ == "__main__":
    print("UIAgent loaded OK")
    print(f"  Tools: {[t.name for t in ui_agent.tools]}")
    print(f"  Prompt length: {len(ui_agent.system_prompt)} chars")
