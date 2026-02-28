"""
MiniMax API service — text generation (main) and TTS (alternative provider).

Base URL : https://api.minimax.io
Auth     : Bearer <MINIMAX_API_KEY>

All public methods are async and follow the project's lazy-singleton + asyncio.to_thread pattern.
"""

import asyncio
import os
import traceback
import uuid

import requests

from srcs.config import get_settings

# -- Constants ----------------------------------------------------------------

BASE_URL = "https://api.minimax.io"


# -- Helpers ------------------------------------------------------------------

def _headers() -> dict[str, str]:
    settings = get_settings()
    return {
        "Authorization": f"Bearer {settings.MINIMAX_API_KEY}",
        "Content-Type": "application/json",
    }


def _raise_for_minimax(resp_json: dict) -> None:
    """Raise if the MiniMax base_resp indicates an error."""
    base = resp_json.get("base_resp", {})
    code = base.get("status_code", 0)
    if code != 0:
        raise RuntimeError(
            f"MiniMax API error {code}: {base.get('status_msg', 'unknown')}"
        )


# -----------------------------------------------------------------------------
# Text Generation
# -----------------------------------------------------------------------------

class MiniMaxTextService:
    """Chat / text completion via MiniMax.

    POST https://api.minimax.io/v1/text/chatcompletion_v2
    """

    @staticmethod
    async def chat(
        messages: list[dict],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> str:
        """Send a chat completion request and return the assistant text.

        Parameters
        ----------
        messages : list[dict]
            OpenAI-style messages, e.g. [{"role": "user", "content": "Hi"}].
        model : str | None
            Override for the model name (defaults to settings.MINIMAX_TEXT_MODEL).
        temperature : float
            Sampling temperature.
        max_tokens : int
            Maximum tokens to generate.

        Returns
        -------
        str
            The assistant's reply text.
        """
        settings = get_settings()

        def _call() -> str:
            payload = {
                "model": model or settings.MINIMAX_TEXT_MODEL,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            resp = requests.post(
                f"{BASE_URL}/v1/text/chatcompletion_v2",
                headers=_headers(),
                json=payload,
                timeout=120,
            )
            resp.raise_for_status()
            data = resp.json()
            _raise_for_minimax(data)

            choices = data.get("choices", [])
            if not choices:
                return ""
            return choices[0].get("message", {}).get("content", "")

        return await asyncio.to_thread(_call)


# -----------------------------------------------------------------------------
# Text-to-Speech (T2A) — alternative TTS provider
# -----------------------------------------------------------------------------

class MiniMaxTTSService:
    """Synchronous text-to-speech via HTTP.

    POST https://api.minimax.io/v1/t2a_v2
    Supports up to 10,000 characters per request.
    """

    DEFAULT_VOICE_ID = "English_expressive_narrator"

    @staticmethod
    async def generate_tts(
        text: str,
        voice_id: str | None = None,
        model: str | None = None,
        speed: float = 1.0,
        volume: float = 1.0,
        pitch: int = 0,
        audio_format: str = "mp3",
        sample_rate: int = 32000,
        bitrate: int = 128000,
    ) -> str | None:
        """Generate speech from text and save to disk.

        Returns
        -------
        str | None
            A relative URL path to the saved audio file (e.g. "/media/tts/tts_abc123.mp3"),
            or None on failure.
        """
        settings = get_settings()

        def _call() -> str:
            payload = {
                "model": model or settings.MINIMAX_TTS_MODEL,
                "text": text,
                "stream": False,
                "language_boost": "auto",
                "voice_setting": {
                    "voice_id": voice_id or MiniMaxTTSService.DEFAULT_VOICE_ID,
                    "speed": speed,
                    "vol": volume,
                    "pitch": pitch,
                },
                "audio_setting": {
                    "sample_rate": sample_rate,
                    "bitrate": bitrate,
                    "format": audio_format,
                    "channel": 1,
                },
            }
            resp = requests.post(
                f"{BASE_URL}/v1/t2a_v2",
                headers=_headers(),
                json=payload,
                timeout=60,
            )
            resp.raise_for_status()
            data = resp.json()
            _raise_for_minimax(data)

            hex_audio = data.get("data", {}).get("audio", "")
            if not hex_audio:
                raise RuntimeError("No audio data in MiniMax TTS response")

            audio_bytes = bytes.fromhex(hex_audio)
            filename = f"tts_{uuid.uuid4().hex[:8]}.{audio_format}"
            upload_dir = os.path.join(settings.UPLOAD_DIR, "tts")
            os.makedirs(upload_dir, exist_ok=True)
            filepath = os.path.join(upload_dir, filename)

            with open(filepath, "wb") as f:
                f.write(audio_bytes)

            return f"/media/tts/{filename}"

        try:
            return await asyncio.to_thread(_call)
        except Exception as exc:
            traceback.print_exc()
            print(f"MiniMax TTS Error: {exc}")
            return None


# -----------------------------------------------------------------------------
# Convenience facade
# -----------------------------------------------------------------------------

class MiniMaxService:
    """Unified entry point that delegates to the specialised sub-services."""

    text = MiniMaxTextService
    tts = MiniMaxTTSService


# -- Smoke-test ---------------------------------------------------------------

if __name__ == "__main__":
    import sys

    if sys.platform.startswith("win") and sys.version_info < (3, 14):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    async def main():
        svc = MiniMaxService()

        print("=== MiniMax Text Chat ===")
        reply = await svc.text.chat(
            messages=[{"role": "user", "content": "Explain photosynthesis in one sentence."}],
        )
        print(f"  Reply: {reply}")

        print("\n=== MiniMax TTS ===")
        url = await svc.tts.generate_tts("Hello, this is a test of MiniMax text to speech.")
        print(f"  Audio URL: {url}")

    asyncio.run(main())
