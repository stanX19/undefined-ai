"""Import all models so Base.metadata registers every table."""
from srcs.models.user import User
from srcs.models.topic import Topic
from srcs.models.chat_message import ChatMessage
from srcs.models.atomic_fact import AtomicFact
from srcs.models.scene import Scene

__all__ = ["User", "Topic", "ChatMessage", "AtomicFact", "Scene"]
