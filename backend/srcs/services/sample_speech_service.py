# DONT TOUCH!! WILL BE DEVELOPED BY ANOTHER DEVELOPER!!

import os
import uuid
import asyncio
import traceback
from gtts import gTTS
from srcs.config import get_settings

# need to add STT
class SpeechService:
    DEFAULT_TTS_LANG = "en"  # "ms"

    @staticmethod
    async def generate_tts(text: str, lang: str = DEFAULT_TTS_LANG) -> str | None:
        """Generates TTS audio and returns the hosted URL."""
        settings = get_settings()
        try:
            filename = f"tts_{uuid.uuid4().hex[:8]}.mp3"
            upload_dir = os.path.join(settings.UPLOAD_DIR, "tts")
            os.makedirs(upload_dir, exist_ok=True)
            filepath = os.path.join(upload_dir, filename)
            
            def _text_to_speech() -> None:
                tts = gTTS(text=text, lang=lang)
                tts.save(filepath)
            
            await asyncio.to_thread(_text_to_speech)
            return f"/media/tts/{filename}"
        except Exception as exc:
            traceback.print_exc()
            print(f"TTS Error: {exc}")
            return None

    @staticmethod
    def enqueue_tts_and_emit(session_id: str, text: str, lang: str = DEFAULT_TTS_LANG) -> None:
        """
        Runs TTS generation as a background task and emits an SSE event when finished.
        """
        from srcs.services.sse_service import SseService
        from srcs.schemas.chat_dto import SseTTSResultData

        async def _generate_and_emit() -> None:
            url = await TTSService.generate_tts(text, lang)
            if url:
                await SseService.emit(session_id, SseTTSResultData(text=text, audio_url=url))
        
        asyncio.create_task(_generate_and_emit())
