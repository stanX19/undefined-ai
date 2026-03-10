"""
Chatbot agent — LangGraph ReAct agent with tool calling.

Uses the rotating LLM pool and exposes a single ``ask()`` entry-point
for the rest of the application.
"""
import traceback
from typing import Awaitable, Callable

from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, BaseMessage, ToolMessage
from langchain.agents import create_agent

from srcs.config import get_settings
from srcs.services.agents.rotating_llm import rotating_llm
from srcs.services.agents.prompts.main_chatbot import SYSTEM_PROMPT
from srcs.services.agents.tools import (
    retrieve_facts,
    list_topic_facts,
    search_web,
    ingest_url,
    edit_ui,
)


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
        self.tools: list = tools if tools is not None else [
            retrieve_facts, list_topic_facts, search_web, ingest_url, edit_ui,
        ]
        self.system_prompt: str = system_prompt

    # -- public API -------------------------------------------------------

    async def ask(
        self,
        user_prompt: str,
        document_text: str | None = None,
        chat_history: list[BaseMessage] | None = None,
        on_tool_call: Callable[[str, dict], Awaitable[None]] | None = None,
    ) -> tuple[str, list[BaseMessage]]:
        """Send a message through the agent and return the final text answer.

        Args:
            on_tool_call: Optional async callback invoked with ``(tool_name, arguments)``
                          each time the agent calls a tool.
        """
        messages = self._build_messages(user_prompt, document_text, chat_history)
        initial_msg_count = len(messages)

        settings = get_settings()
        if settings.DEBUG:
            print(f"\n[CHATBOT] === USER PROMPT ===\n{user_prompt}\n")

        try:
            llm = await rotating_llm.get_runnable(temperature=0.4)
            agent = create_agent(model=llm, tools=self.tools)

            # Stream events so we can intercept tool calls in real time
            last_ai_message: BaseMessage | None = None
            all_final_messages: list[BaseMessage] = []

            async for event in agent.astream_events(
                {"messages": messages}, version="v2",
            ):
                kind = event.get("event", "")

                # Capture tool-call events and forward via callback
                if kind == "on_chat_model_end":
                    output = event.get("data", {}).get("output")
                    if isinstance(output, AIMessage):
                        if settings.DEBUG:
                            if output.tool_calls:
                                print(f"[CHATBOT] AI Tool Calls: {output.tool_calls}")
                            else:
                                print(f"[CHATBOT] AI Response: {output.content}")
                        
                        if output.tool_calls and on_tool_call:
                            for tc in output.tool_calls:
                                await on_tool_call(tc["name"], tc.get("args", {}))

                if kind == "on_tool_end" and settings.DEBUG:
                    print(f"[CHATBOT] Tool Result ({event['name']}): {event['data'].get('output')}")

                # Track the final AI message from the agent
                if kind == "on_chain_end" and event.get("name") == "LangGraph":
                    output = event.get("data", {}).get("output", {})
                    final_msgs = output.get("messages", [])
                    if final_msgs:
                        last_ai_message = final_msgs[-1]
                        all_final_messages = final_msgs

            if last_ai_message is None:
                return "I'm sorry, I couldn't generate a response.", []

            new_msgs = all_final_messages[initial_msg_count:-1] if len(all_final_messages) > initial_msg_count else []
            return self._extract_text(last_ai_message.content), new_msgs

        except Exception as exc:
            traceback.print_exc()
            return f"An error occurred while processing your request: {exc}", []

    # -- internals --------------------------------------------------------

    @staticmethod
    def _extract_text(content: str | list) -> str:
        """Extract plain text from LangChain message content.

        ``content`` may be a plain string or a list of content blocks
        (e.g. ``[{'type': 'text', 'text': '...', 'extras': {...}}]``).
        """
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts = []
            for block in content:
                if isinstance(block, str):
                    parts.append(block)
                elif isinstance(block, dict) and block.get("type") == "text":
                    parts.append(block.get("text", ""))
            return "".join(parts) if parts else str(content)
        return str(content)


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

        prompt = user_prompt.strip()
        if not prompt:
            prompt = "[EMPTY MESSAGE]"

        messages.append(HumanMessage(content=prompt))

        return messages


# -- Module-level singleton ---------------------------------------------------
chatbot = Chatbot()
