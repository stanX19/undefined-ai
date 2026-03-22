"""Speech route for audio transcription (STT)."""
import os

from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from srcs.config import get_settings
from srcs.database import get_db
from srcs.services.speech_service import SpeechService
from srcs.services.usage_service import UsageService
from srcs.dependencies import get_current_user
from srcs.models.user import User

router: APIRouter = APIRouter(prefix="/api/v1/speech", tags=["speech"])

_ALLOWED_AUDIO_EXTENSIONS = {
    ".mp3", ".mp4", ".mpeg", ".mpga", ".m4a",
    ".wav", ".webm", ".ogg", ".flac",
}


@router.post("/stt")
async def speech_to_text(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Transcribe an uploaded audio file to text using ElevenLabs Scribe."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in _ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format '{ext}'. Accepted: {', '.join(sorted(_ALLOWED_AUDIO_EXTENSIONS))}",
        )

    content: bytes = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded audio file is empty")

    settings = get_settings()
    await UsageService.check_and_consume_units(db, current_user, settings.UNIT_COST_SPEECH)

    transcript: str | None = await SpeechService.transcribe_audio(content)

    if transcript is None:
        raise HTTPException(status_code=500, detail="Speech-to-text processing failed or returned no text")

    return {"text": transcript}
