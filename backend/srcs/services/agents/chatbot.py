"""
Chatbot agent — LangGraph ReAct agent with tool calling.

Uses the rotating LLM pool and exposes a single ``ask()`` entry-point
for the rest of the application.
"""
import traceback

from langchain_core.messages import HumanMessage, SystemMessage, BaseMessage
from langchain.agents import create_agent

from srcs.services.agents.rotating_llm import rotating_llm
from srcs.services.agents.prompts.main_chatbot import SYSTEM_PROMPT
from srcs.services.agents.tools import toggle_ui, retrieve_facts, list_topic_facts


class Chatbot:
    """LangGraph ReAct agent backed by RotatingLLM.

    Instantiate once and reuse — the instance holds the tool list and
    system prompt but is otherwise stateless.
    """

    def __init__(
        self,
        tools: list | None = None,
        system_prompt: str = SYSTEM_PROMPT,
    ) -> None:
        self.tools: list = tools if tools is not None else [toggle_ui, retrieve_facts, list_topic_facts]
        self.system_prompt: str = system_prompt

    # ── public API ───────────────────────────────────────────────────────

    async def ask(
        self,
        user_prompt: str,
        document_text: str | None = None,
        chat_history: list[BaseMessage] | None = None,
    ) -> str:
        """Send a message through the agent and return the final text answer."""
        messages = self._build_messages(user_prompt, document_text, chat_history)

        try:
            llm = await rotating_llm.get_runnable(temperature=0.4)
            agent = create_agent(model=llm, tools=self.tools)
            result = await agent.ainvoke({"messages": messages})  # type: ignore[arg-type]

            final_messages: list[BaseMessage] = result.get("messages", [])
            if not final_messages:
                return "I'm sorry, I couldn't generate a response."

            content = final_messages[-1].content
            if isinstance(content, list):
                return "".join(
                    block.get("text", "") for block in content if isinstance(block, dict)
                )
            return str(content)

        except Exception as exc:
            traceback.print_exc()
            return f"An error occurred while processing your request: {exc}"

    # ── internals ────────────────────────────────────────────────────────

    def _build_messages(
        self,
        user_prompt: str,
        document_text: str | None,
        chat_history: list[BaseMessage] | None,
    ) -> list[BaseMessage]:
        """Assemble the full message list for the agent."""
        system_parts: list[str] = [self.system_prompt]
        if document_text:
            system_parts.append(
                f"\n\n--- DOCUMENT CONTEXT ---\n{document_text}\n--- END CONTEXT ---"
            )

        messages: list[BaseMessage] = [SystemMessage(content="\n".join(system_parts))]

        if chat_history:
            messages.extend(chat_history)

        messages.append(HumanMessage(content=user_prompt))
        return messages


# ── Module-level singleton ───────────────────────────────────────────────────
chatbot = Chatbot()
