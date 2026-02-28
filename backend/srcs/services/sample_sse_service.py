import json
import asyncio
from typing import Union
from srcs.schemas.chat_dto import (
    SseEvent,
    SseNotifData,
    SseRepliesData,
    SseUpdateChecklistData,
    SseEditDocumentData,
    SseTTSResultData
)

# need to make it in class and private, add static method in SseService to open and add stream instead
active_streams: dict[str, asyncio.Queue] = {}

class SseService:
    @staticmethod
    async def _emit(session_id: str, event: SseEvent, payload: Union[SseNotifData, SseRepliesData, SseUpdateChecklistData, SseEditDocumentData, SseTTSResultData]) -> None:
        """
        Emits an SSE event to the specified session stream.
        """
        if session_id in active_streams:
            await active_streams[session_id].put({
                "event": event.value,
                "data": payload.model_dump_json(exclude_none=True)
            })

    @staticmethod
    async def emit(session_id: str, payload: Union[SseNotifData, SseRepliesData, SseUpdateChecklistData, SseEditDocumentData, SseTTSResultData]) -> None:
        """
        Automatically detects the appropriate event type based on the provided payload class.
        IMPORTANT: Any changes made to the SSE schema here must be reflected in API_DOCUMENTATION.md!
        We don't allow undefined/custom/unmatched SSE events.
        """
        event_map = {
            SseNotifData: SseEvent.NOTIF,
            SseRepliesData: SseEvent.REPLIES,
            SseUpdateChecklistData: SseEvent.UPDATE_CHECKLIST,
            SseEditDocumentData: SseEvent.EDIT_DOCUMENT,
            SseTTSResultData: SseEvent.TTS_RESULT
        }

        event_type = event_map.get(type(payload))
        if not event_type:
            raise ValueError(f"Unknown payload type: {type(payload)}")

        await SseService._emit(session_id, event_type, payload)
