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
from srcs.services.agents.tools import toggle_ui

# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

TOOLS: list = [toggle_ui]

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

class Chatbot:
    """Thin wrapper around a LangGraph ReAct agent backed by RotatingLLM."""

    @staticmethod
    async def ask(
        user_prompt: str,
        document_text: str | None = None,
        chat_history: list[BaseMessage] | None = None,
    ) -> str:
        """Send a message through the agent and return the final text answer.

        Args:
            user_prompt: The user's current question.
            document_text: Full document context (may be ``None``).
            chat_history: Previous conversation messages.

        Returns:
            The assistant's text reply.
        """
        # Build system context
        system_parts: list[str] = [SYSTEM_PROMPT]
        if document_text:
            system_parts.append(
                f"\n\n--- DOCUMENT CONTEXT ---\n{document_text}\n--- END CONTEXT ---"
            )

        messages: list[BaseMessage] = [SystemMessage(content="\n".join(system_parts))]

        if chat_history:
            messages.extend(chat_history)

        messages.append(HumanMessage(content=user_prompt))

        try:
            # Get a runnable model from the rotating pool
            llm = await rotating_llm.get_runnable(temperature=0.4)

            # Build a LangGraph ReAct agent with our tools
            agent = create_agent(model=llm, tools=TOOLS)

            result = await agent.ainvoke({"messages": messages})  # type: ignore[arg-type]

            # The last message in the result is the final AI reply
            final_messages: list[BaseMessage] = result.get("messages", [])
            if not final_messages:
                return "I'm sorry, I couldn't generate a response."

            return str(final_messages[-1].content)

        except Exception as exc:
            traceback.print_exc()
            return f"An error occurred while processing your request: {exc}"
