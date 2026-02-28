"""Chat routes — send messages and manage history."""
from fastapi import APIRouter, Depends, HTTPException
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
from sqlalchemy.ext.asyncio import AsyncSession

from srcs.database import get_db
from srcs.schemas.chat_dto import ChatRequest, ChatMessageResponse, AgentReplyResponse
from srcs.services.chat_service import ChatService
from srcs.services.topic_service import TopicService
from srcs.services.agents.chatbot import Chatbot

router: APIRouter = APIRouter(prefix="/api/v1/chat", tags=["chat"])


@router.post("/", response_model=AgentReplyResponse)
async def send_message(
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
) -> AgentReplyResponse:
    """Send a user message, run the agent, and return both messages.

    Flow:
        1. Validate topic exists
        2. Persist user message
        3. Build chat history as LangChain messages
        4. Call ``Chatbot.ask()`` with document context + history
        5. Persist assistant reply
        6. Return both messages
    """
    topic = await TopicService.get_topic(db, body.topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    # 1. Persist incoming user message
    user_msg = await ChatService.add_message(db, body.topic_id, "user", body.message)

    # 2. Build LangChain-format history (excluding the message we just added)
    history_rows = await ChatService.get_history(db, body.topic_id, limit=50)
    lc_history: list[BaseMessage] = []
    for row in history_rows:
        if row.message_id == user_msg.message_id:
            continue  # skip current — we'll pass it as user_prompt
        if row.role == "user":
            lc_history.append(HumanMessage(content=row.message))
        else:
            lc_history.append(AIMessage(content=row.message))

    # 3. Call agent
    answer: str = await Chatbot.ask(
        user_prompt=body.message,
        document_text=topic.document_text,
        chat_history=lc_history if lc_history else None,
    )

    # 4. Persist assistant reply
    assistant_msg = await ChatService.add_message(db, body.topic_id, "assistant", answer)

    return AgentReplyResponse(
        user_message=ChatMessageResponse.model_validate(user_msg),
        assistant_message=ChatMessageResponse.model_validate(assistant_msg),
    )


@router.get("/history", response_model=list[ChatMessageResponse])
async def get_history(
    topic_id: str,
    db: AsyncSession = Depends(get_db),
) -> list[ChatMessageResponse]:
    """Return chat history for a topic."""
    messages = await ChatService.get_history(db, topic_id)
    return [ChatMessageResponse.model_validate(m) for m in messages]


@router.delete("/history")
async def clear_history(
    topic_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Delete all chat messages for a topic."""
    deleted: int = await ChatService.clear_history(db, topic_id)
    return {"message": f"Cleared {deleted} messages"}
