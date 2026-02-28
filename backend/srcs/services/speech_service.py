import io
import os
import uuid
import asyncio
import traceback
from elevenlabs.client import ElevenLabs

from srcs.config import get_settings

_client: ElevenLabs | None = None


def _get_client() -> ElevenLabs:
    global _client
    if _client is None:
        settings = get_settings()
        _client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)
    return _client


class SpeechService:
    DEFAULT_TTS_LANG = "en"  # "ms"

    @staticmethod
    async def generate_tts(
        text: str,
        voice_id: str | None = None,
        model_id: str | None = None,
    ) -> str | None:
        """Generates TTS audio via ElevenLabs and returns the hosted URL."""
        settings = get_settings()
        try:
            filename = f"tts_{uuid.uuid4().hex[:8]}.mp3"
            upload_dir = os.path.join(settings.UPLOAD_DIR, "tts")
            os.makedirs(upload_dir, exist_ok=True)
            filepath = os.path.join(upload_dir, filename)

            def _text_to_speech() -> None:
                client = _get_client()
                audio_iterator = client.text_to_speech.convert(
                    text=text,
                    voice_id=voice_id or settings.ELEVENLABS_DEFAULT_VOICE_ID,
                    model_id=model_id or settings.ELEVENLABS_MODEL,
                )
                with open(filepath, "wb") as f:
                    for chunk in audio_iterator:
                        if isinstance(chunk, bytes):
                            f.write(chunk)

            await asyncio.to_thread(_text_to_speech)
            return f"/media/tts/{filename}"
        except Exception as exc:
            traceback.print_exc()
            print(f"TTS Error: {exc}")
            return None

    @staticmethod
    async def transcribe_audio(
        audio_data: bytes,
        language_code: str | None = None,
    ) -> str | None:
        """Transcribes audio bytes to text via ElevenLabs Scribe. Returns the transcript."""
        try:
            def _speech_to_text() -> str:
                client = _get_client()
                result = client.speech_to_text.convert(
                file=audio_data,
                model_id="scribe_v1",
            )
                return result.text

            return await asyncio.to_thread(_speech_to_text)
        except Exception as exc:
            traceback.print_exc()
            print(f"STT Error: {exc}")
            return None

    @staticmethod
    async def transcribe_audio_file(
        filepath: str,
        language_code: str | None = None,
    ) -> str | None:
        """Transcribes an audio file from disk to text. Convenience wrapper around transcribe_audio."""
        try:
            with open(filepath, "rb") as f:
                audio_data = f.read()
            return await SpeechService.transcribe_audio(audio_data, language_code)
        except Exception as exc:
            traceback.print_exc()
            print(f"STT File Error: {exc}")
            return None

    @staticmethod
    def enqueue_tts_and_emit(session_id: str, text: str) -> None:
        """
        Runs TTS generation as a background task and emits an SSE event when finished.
        """
        from srcs.services.sse_service import SseService
        from srcs.schemas.chat_dto import SseTTSResultData

        async def _generate_and_emit() -> None:
            url = await SpeechService.generate_tts(text)
            if url:
                await SseService.emit(session_id, SseTTSResultData(text=text, audio_url=url))

        asyncio.create_task(_generate_and_emit())


if __name__ == "__main__":
    import sys

    if sys.platform.startswith("win") and sys.version_info < (3, 14):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    async def main():
        service = SpeechService()

        print("=== generate_tts() ===")
        url = await service.generate_tts("Hello! This is a test of the ElevenLabs text to speech integration.")
        print(f"  Audio URL: {url}")

        if url:
            settings = get_settings()
            src = os.path.join(settings.UPLOAD_DIR, "tts", os.path.basename(url))
            dst = os.path.join(r"C:\Users\jayde\Downloads", os.path.basename(url))
            os.makedirs(r"C:\Users\jayde\Downloads", exist_ok=True)
            import shutil
            shutil.copy2(src, dst)
            print(f"  Audio copied to: {dst}")

        print("\n=== transcribe_audio_file() (sample file) ===")
        sample_path = r"C:\asd\backend\Five Second TEXT.mp3"
        if os.path.exists(sample_path):
            transcript = await service.transcribe_audio_file(sample_path)
            print(f"  Transcript: {transcript}")
        else:
            print(f"  Sample file not found: {sample_path}")

    asyncio.run(main())
