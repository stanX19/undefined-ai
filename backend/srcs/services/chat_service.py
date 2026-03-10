"""Chat service – message persistence, history retrieval, and agent orchestration."""
import asyncio
import json

from langchain_core.messages import HumanMessage, AIMessage, BaseMessage, ToolMessage
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from srcs.models.chat_message import ChatMessage
from srcs.schemas.chat_dto import SseNotifData, SseRepliesData, SseToolCallData
from srcs.services.sse_service import SseService
from srcs.services.speech_service import SpeechService
from srcs.services.agents.chatbot import chatbot
from srcs.services.agents.id_mapper import ShortIdMapper, set_mapper
from srcs.services.agents.tool_registry import ToolRegistry


class ChatService:
    """Reusable chat-history operations + agent orchestration."""

    # -- Agent orchestration ----------------------------------------------

    @staticmethod
    async def send_message(
        db: AsyncSession, topic_id: str, message: str, document_text: str | None,
    ) -> ChatMessage:
        """Persist a user message and kick off the agent reply in the background.

        Returns the persisted user ``ChatMessage`` immediately.
        The agent reply is emitted via SSE once ready.
        """
        prompt = message.strip() if message else ""
        if not prompt:
            prompt = "[EMPTY MESSAGE]"

        user_msg = await ChatService.add_message(db, topic_id, "user", prompt)

        asyncio.create_task(
            ChatService._run_agent_and_stream(
                topic_id=topic_id,
                user_prompt=prompt,
                document_text=document_text,
                exclude_message_id=user_msg.message_id,
            )
        )

        return user_msg

    # -- Persistence helpers ----------------------------------------------

    @staticmethod
    async def add_message(
        db: AsyncSession, topic_id: str, role: str, message: str
    ) -> ChatMessage:
        """Persist a single chat message."""
        msg = ChatMessage(topic_id=topic_id, role=role, message=message)
        db.add(msg)
        await db.flush()      # populates server-side defaults (message_id, created_at)
        await db.commit()
        return msg

    @staticmethod
    async def get_history(
        db: AsyncSession, topic_id: str, limit: int = 10
    ) -> list[ChatMessage]:
        """Return the latest chat history for a topic, oldest-first, capped by *limit*."""
        result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.topic_id == topic_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(limit)
        )
        rows = list(result.scalars().all())
        rows.reverse()
        return rows

    @staticmethod
    async def get_chat_history(
        db: AsyncSession, topic_id: str, limit: int = 100
    ) -> list[ChatMessage]:
        """Return chat history excluding tool calls (for frontend)."""
        rows = await ChatService.get_history(db, topic_id, limit=limit)
        return [r for r in rows if r.role in ("user", "assistant")]

    @staticmethod
    async def get_history_for_chatbot(
        db: AsyncSession, topic_id: str, limit: int = 50
    ) -> list[ChatMessage]:
        """Return full chat history including tool calls for the agent."""
        return await ChatService.get_history(db, topic_id, limit=limit)

    @staticmethod
    async def clear_history(db: AsyncSession, topic_id: str) -> int:
        """Delete all messages for a topic. Returns number of deleted rows."""
        result = await db.execute(
            delete(ChatMessage).where(ChatMessage.topic_id == topic_id)
        )
        await db.commit()
        return result.rowcount  # type: ignore[return-value]

    # -- Private helpers --------------------------------------------------

    @staticmethod
    def _truncate_text(text: str, max_length: int = 500) -> str:
        if len(text) <= max_length:
            return text
        return text[:max_length] + "... [Truncated]"

    @staticmethod
    def _truncate_dict(d: dict, max_length: int = 500) -> dict:
        truncated = {}
        for k, v in d.items():
            if isinstance(v, str):
                truncated[k] = ChatService._truncate_text(v, max_length)
            elif isinstance(v, dict):
                truncated[k] = ChatService._truncate_dict(v, max_length)
            elif isinstance(v, list):
                # Simple truncation for list to avoid complex recursion
                truncated[k] = [
                    ChatService._truncate_text(str(i), max_length) if isinstance(i, str) else i 
                    for i in v
                ]
            else:
                truncated[k] = v
        return truncated

    @staticmethod
    async def _persist_agent_memory(
        db: AsyncSession, topic_id: str, new_msgs: list[BaseMessage]
    ) -> None:
        """Persist intermediate tool calls and results from the agent's run."""
        for msg in new_msgs:
            if isinstance(msg, AIMessage) and msg.tool_calls:
                truncated_calls = []
                for tc in msg.tool_calls:
                    truncated_args = ChatService._truncate_dict(tc.get("args", {}))
                    truncated_calls.append({
                        "id": tc.get("id"),
                        "name": tc["name"],
                        "args": truncated_args
                    })
                
                payload = {
                    "content": ChatService._truncate_text(msg.content) if isinstance(msg.content, str) else "",
                    "tool_calls": truncated_calls
                }
                await ChatService.add_message(db, topic_id, "tool_call", json.dumps(payload))
                
            elif isinstance(msg, ToolMessage):
                # Check if the tool has logic to replace the log content (Option 6)
                log_content = ToolRegistry.get_metadata(msg.name, "log_replacement") or msg.content

                payload = {
                    "tool_call_id": msg.tool_call_id,
                    "name": msg.name,
                    "content": ChatService._truncate_text(log_content, max_length=1500)
                }
                await ChatService.add_message(db, topic_id, "tool_result", json.dumps(payload))

    @staticmethod
    async def _build_lc_history(
        db: AsyncSession, topic_id: str, exclude_id: str | None = None,
    ) -> list[BaseMessage] | None:
        """Build LangChain-format chat history, optionally skipping one message."""
        rows = await ChatService.get_history_for_chatbot(db, topic_id, limit=50)
        history: list[BaseMessage] = []
        for row in rows:
            if row.message_id == exclude_id:
                continue
            if row.role == "user":
                history.append(HumanMessage(content=row.message))
            elif row.role == "assistant":
                history.append(AIMessage(content=row.message))
            elif row.role == "tool_call":
                try:
                    data = json.loads(row.message)
                    history.append(AIMessage(
                        content=data.get("content", ""),
                        tool_calls=data.get("tool_calls", [])
                    ))
                except json.JSONDecodeError:
                    pass
            elif row.role == "tool_result":
                try:
                    data = json.loads(row.message)
                    history.append(ToolMessage(
                        content=data.get("content", ""),
                        name=data.get("name", ""),
                        tool_call_id=data.get("tool_call_id", "")
                    ))
                except json.JSONDecodeError:
                    pass
        
        # --- [ROBUST SANITIZATION FOR GEMINI PROTOCOL] ---
        sanitized: list[BaseMessage] = []
        last_role = None
        
        for msg in history:
            role = type(msg).__name__
            
            # 1. Skip messages with empty content (blocks SDK-side stripping errors)
            if not msg.content and not (isinstance(msg, AIMessage) and msg.tool_calls):
                continue
                
            # 2. Enforce alternating roles (Human/AI)
            if role == last_role and role in ("HumanMessage", "AIMessage"):
                continue
                
            # 3. Handle Tool sequence integrity
            if isinstance(msg, ToolMessage):
                if not sanitized or not (isinstance(sanitized[-1], AIMessage) and sanitized[-1].tool_calls):
                    continue
            
            # 4. Success - add to sanitized history
            sanitized.append(msg)
            last_role = role

        # Final check: History MUST start with a HumanMessage for Gemini after System
        while sanitized and not isinstance(sanitized[0], HumanMessage):
            sanitized.pop(0)
            
        # Final check: If last message is an AIMessage with tool_calls, it's 'orphaned' 
        if sanitized and isinstance(sanitized[-1], AIMessage) and sanitized[-1].tool_calls:
            sanitized.pop()

        return sanitized or None

    @staticmethod
    async def _run_agent_and_stream(
        topic_id: str,
        user_prompt: str,
        document_text: str | None,
        exclude_message_id: str,
    ) -> None:
        """Background coroutine: build history, call agent, persist reply, emit SSE."""
        from srcs.database import AsyncSessionLocal
        from srcs.services.retrieval_service import RetrievalService
        from srcs.services.ui_service import UIService

        session_id = topic_id  # Phase 1: topic_id == SSE session_id

        # Set up short-ID mapper so the LLM never sees raw UUIDs
        mapper = ShortIdMapper()
        topic_alias = mapper.register(topic_id, prefix="T")
        set_mapper(mapper)

        await SseService.emit(session_id, SseNotifData(message="Processing your message…"))

        try:
            # Use a fresh session so we see all previously committed data
            async with AsyncSessionLocal() as db:
                chat_history = await ChatService._build_lc_history(
                    db, topic_id, exclude_id=exclude_message_id,
                )

                # Ensure the LLM always knows the current topic ID to pass to tools:
                base_info = f"CURRENT TOPIC ID: '{topic_alias}'. You MUST use this topic_id for all tool calls (edit_ui, retrieve_facts, etc).\n\n"
                
                # Fetch current MarkGraph UI Document
                current_ui = await UIService.get_ui_markdown(db, topic_id)
                ui_info = f"--- CURRENT MARKGRAPH UI STATE ---\n{current_ui}\n--- END UI STATE ---\n\n"

                context_text: str | None = document_text or "No document provided."
                max_level = await RetrievalService.get_max_level(db, topic_id)
                if max_level is not None and max_level >= 1:
                    top_facts = await RetrievalService.get_facts_by_level(db, topic_id, level=max_level)
                    if top_facts:
                        concepts: list[str] = [f"- {f.content}" for f in top_facts]
                        context_text = (
                            f"TOPIC KNOWLEDGE (max_level={max_level}, levels 0-{max_level} available).\n"
                            f"Use list_topic_facts with topic_id='{topic_alias}' and level=0..{max_level} to browse.\n"
                            f"Use retrieve_facts to drill into a specific fact_id.\n\n"
                            f"TOP-LEVEL SUMMARY (level {max_level}):\n"
                            + "\n".join(concepts)
                        )
                
                context_text = base_info + ui_info + context_text

            async def _on_tool_call(tool_name: str, arguments: dict) -> None:
                await SseService.emit(
                    session_id,
                    SseToolCallData(tool_name=tool_name, arguments=arguments),
                )

            answer, new_msgs = await chatbot.ask(
                user_prompt=user_prompt,
                document_text=context_text,
                chat_history=chat_history,
                on_tool_call=_on_tool_call,
            )

            async with AsyncSessionLocal() as db:
                await ChatService._persist_agent_memory(db, topic_id, new_msgs)
                assistant_msg = await ChatService.add_message(db, topic_id, "assistant", answer)
                reply_message_id = assistant_msg.message_id

            await SseService.emit(
                session_id,
                SseRepliesData(message_id=reply_message_id, text=answer),
            )

            SpeechService.enqueue_tts_and_emit(session_id, answer)
            await ChatService._trigger_summary_if_needed(session_id, topic_id)

        except Exception as exc:
            import traceback
            traceback.print_exc()
            await SseService.emit(session_id, SseNotifData(message=f"Error: {exc}"))

    @staticmethod
    async def _trigger_summary_if_needed(session_id: str, topic_id: str) -> None:
        """Isolated method to cautiously trigger a topic summary update if we hit N-th message interval."""
        from srcs.database import AsyncSessionLocal
        from srcs.services.summary_service import SummaryService

        try:
            async with AsyncSessionLocal() as db:
                history = await ChatService.get_history(db, topic_id, limit=100)
            
            assistant_count: int = sum(1 for m in history if m.role == "assistant")
            n: int = assistant_count
            if (n & (n - 1)) == 0:  # is power of 2
                SummaryService.enqueue_topic_summary(session_id, topic_id)
        except Exception as exc:
            import traceback
            traceback.print_exc()
