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


# ---------------------------------------------------------------------------
# UIAgent-specific tools — each creates its own DB session to stay stateless
# ---------------------------------------------------------------------------

@tool
async def get_ui(topic_id: str) -> str:
    """Read the current full UI JSON for a topic.

    Returns the entire A2UI v3.0 document as a JSON string.
    Call this first to understand what already exists before editing.

    Args:
        topic_id: The topic whose UI to read.

    Returns:
        The full A2UI JSON document as a formatted string.
    """
    from srcs.database import AsyncSessionLocal
    from srcs.services.ui_service import UIService

    async with AsyncSessionLocal() as db:
        ui = await UIService.get_ui_json(db, topic_id)
    return json.dumps(ui, indent=2)


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

    async with AsyncSessionLocal() as db:
        await UIService.remove_element(db, topic_id, element_id)
    return f"Element '{element_id}' removed."


@tool
async def list_elements(topic_id: str) -> str:
    """List all UI elements with their IDs and types.

    Returns a concise overview of the current UI structure.

    Args:
        topic_id: The topic to inspect.

    Returns:
        A formatted list of element IDs and types.
    """
    from srcs.database import AsyncSessionLocal
    from srcs.services.ui_service import UIService

    async with AsyncSessionLocal() as db:
        items = await UIService.list_elements(db, topic_id)

    if not items:
        return "No elements exist yet. Start by creating a root layout."

    lines = [f"=== {len(items)} elements ==="]
    for item in items:
        lines.append(f"  [{item['id']}] type={item['type']}")
    return "\n".join(lines)


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

    async with AsyncSessionLocal() as db:
        await UIService.set_root_id(db, topic_id, root_id)
    return f"Root ID set to '{root_id}'."


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
            get_ui, set_element, remove_element, list_elements, set_root_id,
            retrieve_facts, list_topic_facts,
        ]
        self.system_prompt = UI_AGENT_PROMPT

    async def edit(self, topic_id: str, prompt: str) -> dict:
        """Run the agent to edit the UI for *topic_id* per *prompt*.

        Returns the final ``ui_json`` after all edits.
        """
        messages: list[BaseMessage] = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=(
                f"Topic ID: {topic_id}\n\n"
                f"Instruction: {prompt}"
            )),
        ]

        try:
            llm = await rotating_llm.get_runnable(temperature=0.3)
            agent = create_agent(model=llm, tools=self.tools)
            await agent.ainvoke({"messages": messages})

            # After the agent has finished calling tools, read back the final state
            from srcs.database import AsyncSessionLocal
            from srcs.services.ui_service import UIService

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
