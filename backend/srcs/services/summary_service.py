"""Summary service to auto-generate topic titles based on chat history."""
import asyncio
import traceback

from sqlalchemy.ext.asyncio import AsyncSession
from srcs.database import AsyncSessionLocal
from srcs.models.topic import Topic
from srcs.schemas.chat_dto import SseUpdateTitleData
from srcs.services.agents.cached_llm import cached_llm as rotating_llm
from srcs.services.chat_service import ChatService
from srcs.services.sse_service import SseService


from langchain_core.messages import SystemMessage, HumanMessage

_GENERAL_SUMMARY_PROMOT = """\
You are a summarization AI.
Create a summary for the following text.
Your response MUST be {length} words or less.
Return ONLY the exact summary text, without quotes, explanations, or any other formatting.\"""
"""

_GENERATE_TITLE_PROMPT = """\
You are a summarization AI.
Create a succinct title for the topic based on the following text.
Focus on the topic instead of conversation logs.
Your response MUST be {length} words or less.
Return ONLY the exact title text, without quotes, explanations, or any other formatting.\
"""


class SummaryService:
    """Service for generating summaries and auto-updating topic titles."""

    @staticmethod
    async def generate_summary(text: str, length: int = 5) -> str:
        """Generate a brief summary of the text."""
        system_prompt: str = _GENERATE_TITLE_PROMPT.format(length=length)
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"TEXT:\n{text}")
        ]
        
        try:
            response = await rotating_llm.send_message(
                messages, temperature=0.3
            )
            
            title = response.text.strip()
            
            # Strip quotes if the LLM adds them despite instructions
            if title.startswith('"') and title.endswith('"'):
                title = title[1:-1]
            if title.startswith("'") and title.endswith("'"):
                title = title[1:-1]
                
            return title[:100]  # Hard bound just in case
            
        except Exception as exc:
            traceback.print_exc()
            return "New Topic"

    @staticmethod
    def enqueue_topic_summary(session_id: str, topic_id: str, length: int = 4) -> None:
        """Enqueue a background task to generate a topic title from history."""
        asyncio.create_task(
            SummaryService._process_topic_summary(session_id, topic_id, length)
        )

    @staticmethod
    async def fetch_highest_level_facts(db: AsyncSession, topic_id: str) -> str:
        """Fetch the most abstract knowledge facts available for a topic."""
        from srcs.services.retrieval_service import RetrievalService

        max_level = await RetrievalService.get_max_level(db, topic_id)
        if max_level is None:
            return ""

        facts = await RetrievalService.get_facts_by_level(db, topic_id, level=max_level)
        if not facts:
            return ""

        return "\n".join(f"- {f.content}" for f in facts)

    @staticmethod
    async def _process_topic_summary(
        session_id: str, topic_id: str, length: int
    ) -> None:
        """Background worker to fetch history, generate summary, and emit SSE."""
        try:
            async with AsyncSessionLocal() as db:
                topic: Topic | None = await db.get(Topic, topic_id)
                if not topic:
                    return
                topic_title = topic.title
                
                # Fetch recent messages
                history_rows = await ChatService.get_history(db, topic_id, limit=50)
                if not history_rows:
                    return
                
                # Get the last 5 messages for context
                recent_messages = history_rows[-5:]
                
                chat_context_lines: list[str] = []
                for msg in recent_messages:
                    role = "User" if msg.role == "user" else "Assistant"
                    chat_context_lines.append(f"{role}: {msg.message}")
                
                context_str: str = "\n".join(chat_context_lines)
                
                top_facts = await SummaryService.fetch_highest_level_facts(db, topic_id)

            full_text: str = (
                f"Current Title: {topic_title}\n"
                f"Knowledge Facts (Highest level):\n{top_facts}\n"
                f"Recent Chat History:\n{context_str}"
            )
            
            new_title: str = await SummaryService.generate_summary(full_text, length)
            if not new_title or new_title == "New Topic":
                return
                
            async with AsyncSessionLocal() as db:
                topic = await db.get(Topic, topic_id)
                if topic:
                    topic.title = new_title
                    await db.commit()
                
            # Emit SSE outside of DB block
            await SseService.emit(
                session_id,
                SseUpdateTitleData(topic_id=topic_id, title=new_title)
            )
            
        except Exception as exc:
            traceback.print_exc()
