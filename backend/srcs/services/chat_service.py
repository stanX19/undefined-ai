"""Chat service – message persistence, history retrieval, and agent orchestration."""
import asyncio

from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from srcs.models.chat_message import ChatMessage
from srcs.schemas.chat_dto import SseNotifData, SseRepliesData, SseToolCallData
from srcs.services.sse_service import SseService
from srcs.services.speech_service import SpeechService
from srcs.services.agents.chatbot import chatbot
from srcs.services.agents.id_mapper import ShortIdMapper, set_mapper


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
        user_msg = await ChatService.add_message(db, topic_id, "user", message)

        asyncio.create_task(
            ChatService._run_agent_and_stream(
                topic_id=topic_id,
                user_prompt=message,
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
        db: AsyncSession, topic_id: str, limit: int = 50
    ) -> list[ChatMessage]:
        """Return chat history for a topic, oldest-first, capped by *limit*."""
        result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.topic_id == topic_id)
            .order_by(ChatMessage.created_at.asc())
            .limit(limit)
        )
        return list(result.scalars().all())

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
    async def _build_lc_history(
        db: AsyncSession, topic_id: str, exclude_id: str | None = None,
    ) -> list[BaseMessage] | None:
        """Build LangChain-format chat history, optionally skipping one message."""
        rows = await ChatService.get_history(db, topic_id, limit=50)
        history: list[BaseMessage] = []
        for row in rows:
            if row.message_id == exclude_id:
                continue
            if row.role == "user":
                history.append(HumanMessage(content=row.message))
            else:
                history.append(AIMessage(content=row.message))
        return history or None

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

            answer: str = await chatbot.ask(
                user_prompt=user_prompt,
                document_text=context_text,
                chat_history=chat_history,
                on_tool_call=_on_tool_call,
            )

            async with AsyncSessionLocal() as db:
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
            if assistant_count == 1 or (assistant_count > 0 and assistant_count % 5 == 0):
                SummaryService.enqueue_topic_summary(session_id, topic_id)
        except Exception as exc:
            import traceback
            traceback.print_exc()
