import os
import uuid
import asyncio
import traceback

import requests
from elevenlabs.client import ElevenLabs

from srcs.config import get_settings

# ── ElevenLabs client (lazy singleton) ────────────────────────────────────────

_elevenlabs_client: ElevenLabs | None = None


def _get_elevenlabs_client() -> ElevenLabs:
    global _elevenlabs_client
    if _elevenlabs_client is None:
        settings = get_settings()
        _elevenlabs_client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)
    return _elevenlabs_client


class SpeechService:
    # cantonese.ai endpoints & credentials
    CANTONESE_AI_API_KEY: str = os.getenv("CANTONESE_AI_API_KEY", "")
    CANTONESE_AI_TTS_URL = "https://cantonese.ai/api/tts"
    CANTONESE_AI_STT_URL = "https://cantonese.ai/api/stt"

    LANG_CANTONESE = "yue"
    LANG_ENGLISH = "en"
    LANG_MALAY = "ms"
    DEFAULT_LANG = LANG_CANTONESE

    @staticmethod
    def _is_cantonese(language_code: str | None) -> bool:
        lang = (language_code or SpeechService.DEFAULT_LANG).lower()
        return lang in ("yue", "cantonese", "zh-hk", "yue-hk")

    # ── TTS (public) ──────────────────────────────────────────────────────

    @staticmethod
    async def generate_tts(
        text: str,
        voice_id: str | None = None,
        model_id: str | None = None,
        language_code: str | None = None,
    ) -> str | None:
        """Generate speech from text.

        Routes to cantonese.ai for Cantonese, ElevenLabs for everything else.
        """
        if SpeechService._is_cantonese(language_code):
            return await SpeechService._tts_cantonese(text, voice_id=voice_id)
        return await SpeechService._tts_elevenlabs(text, voice_id=voice_id, model_id=model_id)

    # ── STT (public) ──────────────────────────────────────────────────────

    @staticmethod
    async def transcribe_audio(
        audio_data: bytes,
        language_code: str | None = None,
    ) -> str | None:
        """Transcribe audio bytes to text.

        Routes to cantonese.ai for Cantonese, ElevenLabs Scribe for everything else.
        """
        if SpeechService._is_cantonese(language_code):
            return await SpeechService._stt_cantonese(audio_data)
        return await SpeechService._stt_elevenlabs(audio_data)

    @staticmethod
    async def transcribe_audio_file(
        filepath: str,
        language_code: str | None = None,
    ) -> str | None:
        """Convenience wrapper: read a file from disk then transcribe."""
        try:
            with open(filepath, "rb") as f:
                audio_data = f.read()
            return await SpeechService.transcribe_audio(audio_data, language_code)
        except Exception as exc:
            traceback.print_exc()
            print(f"STT File Error: {exc}")
            return None

    # ── Background TTS + SSE emit ─────────────────────────────────────────

    @staticmethod
    def enqueue_tts_and_emit(
        session_id: str,
        text: str,
        language_code: str | None = None,
    ) -> None:
        """Fire-and-forget TTS → SSE push."""
        from srcs.services.sse_service import SseService
        from srcs.schemas.chat_dto import SseTTSResultData

        async def _generate_and_emit() -> None:
            url = await SpeechService.generate_tts(text, language_code=language_code)
            if url:
                await SseService.emit(session_id, SseTTSResultData(text=text, audio_url=url))

        asyncio.create_task(_generate_and_emit())

    # ── cantonese.ai implementations ──────────────────────────────────────

    @staticmethod
    async def _tts_cantonese(text: str, voice_id: str | None = None) -> str | None:
        settings = get_settings()
        try:
            filename = f"tts_{uuid.uuid4().hex[:8]}.mp3"
            upload_dir = os.path.join(settings.UPLOAD_DIR, "tts")
            os.makedirs(upload_dir, exist_ok=True)
            filepath = os.path.join(upload_dir, filename)

            def _call() -> None:
                payload: dict = {
                    "api_key": SpeechService.CANTONESE_AI_API_KEY,
                    "text": text,
                    "language": "cantonese",
                    "output_extension": "mp3",
                    "speed": 1,
                    "pitch": 0,
                    "should_return_timestamp": False,
                }
                if voice_id:
                    payload["voice_id"] = voice_id
                resp = requests.post(
                    SpeechService.CANTONESE_AI_TTS_URL,
                    json=payload,
                    timeout=30,
                )
                resp.raise_for_status()
                with open(filepath, "wb") as f:
                    f.write(resp.content)

            await asyncio.to_thread(_call)
            return f"/media/tts/{filename}"
        except Exception as exc:
            traceback.print_exc()
            print(f"Cantonese TTS Error: {exc}")
            return None

    @staticmethod
    async def _stt_cantonese(audio_data: bytes) -> str | None:
        """cantonese.ai STT — accepts wav, mp3, m4a, flac, ogg."""
        try:
            def _call() -> str:
                resp = requests.post(
                    SpeechService.CANTONESE_AI_STT_URL,
                    data={
                        "api_key": SpeechService.CANTONESE_AI_API_KEY,
                        "with_timestamp": "false",
                        "with_diarization": "false",
                    },
                    files={"data": ("audio.wav", audio_data, "audio/wav")},
                    timeout=60,
                )
                resp.raise_for_status()
                return resp.json()["text"]

            return await asyncio.to_thread(_call)
        except Exception as exc:
            traceback.print_exc()
            print(f"Cantonese STT Error: {exc}")
            return None

    # ── ElevenLabs implementations ────────────────────────────────────────

    @staticmethod
    async def _tts_elevenlabs(
        text: str,
        voice_id: str | None = None,
        model_id: str | None = None,
    ) -> str | None:
        settings = get_settings()
        try:
            filename = f"tts_{uuid.uuid4().hex[:8]}.mp3"
            upload_dir = os.path.join(settings.UPLOAD_DIR, "tts")
            os.makedirs(upload_dir, exist_ok=True)
            filepath = os.path.join(upload_dir, filename)

            def _call() -> None:
                client = _get_elevenlabs_client()
                audio_iterator = client.text_to_speech.convert(
                    text=text,
                    voice_id=voice_id or settings.ELEVENLABS_DEFAULT_VOICE_ID,
                    model_id=model_id or settings.ELEVENLABS_MODEL,
                )
                with open(filepath, "wb") as f:
                    for chunk in audio_iterator:
                        if isinstance(chunk, bytes):
                            f.write(chunk)

            await asyncio.to_thread(_call)
            return f"/media/tts/{filename}"
        except Exception as exc:
            traceback.print_exc()
            print(f"ElevenLabs TTS Error: {exc}")
            return None

    @staticmethod
    async def _stt_elevenlabs(audio_data: bytes) -> str | None:
        try:
            def _call() -> str:
                client = _get_elevenlabs_client()
                result = client.speech_to_text.convert(
                    file=audio_data,
                    model_id="scribe_v1",
                )
                return result.text

            return await asyncio.to_thread(_call)
        except Exception as exc:
            traceback.print_exc()
            print(f"ElevenLabs STT Error: {exc}")
            return None


if __name__ == "__main__":
    import sys

    if sys.platform.startswith("win") and sys.version_info < (3, 14):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    async def main():
        service = SpeechService()

        print("=== Cantonese TTS (cantonese.ai) ===")
        url = await service.generate_tts("你今日食咗飯未？", language_code="yue")
        print(f"  Audio URL: {url}")

        print("\n=== English TTS (ElevenLabs) ===")
        url = await service.generate_tts(
            "Hello! This is a test of the ElevenLabs text to speech integration.",
            language_code="en",
        )
        print(f"  Audio URL: {url}")

        if url:
            settings = get_settings()
            src = os.path.join(settings.UPLOAD_DIR, "tts", os.path.basename(url))
            dst = os.path.join(r"C:\Users\jayde\Downloads", os.path.basename(url))
            os.makedirs(r"C:\Users\jayde\Downloads", exist_ok=True)
            import shutil
            shutil.copy2(src, dst)
            print(f"  Audio copied to: {dst}")

        print("\n=== Cantonese STT (cantonese.ai) ===")
        sample_path = r"C:\asd\backend\Five Second TEXT.mp3"
        if os.path.exists(sample_path):
            transcript = await service.transcribe_audio_file(sample_path, language_code="yue")
            print(f"  Transcript: {transcript}")
        else:
            print(f"  Sample file not found: {sample_path}")

    asyncio.run(main())
