"""Chat DTOs."""
from datetime import datetime

from pydantic import BaseModel


class ChatRequest(BaseModel):
    """Request body for sending a chat message."""
    topic_id: str
    message: str


class ChatMessageResponse(BaseModel):
    """Single chat message in a history list."""
    message_id: str
    role: str
    message: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AgentReplyResponse(BaseModel):
    """Response returned after the agent answers."""
    user_message: ChatMessageResponse
    assistant_message: ChatMessageResponse
