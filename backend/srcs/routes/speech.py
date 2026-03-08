"""Speech route for audio transcription (STT)."""
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends

from srcs.services.speech_service import SpeechService
from srcs.dependencies import get_current_user
from srcs.models.user import User

router: APIRouter = APIRouter(prefix="/api/v1/speech", tags=["speech"])


@router.post("/stt")
async def speech_to_text(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Transcribe an uploaded audio file to text using ElevenLabs Scribe."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    content: bytes = await file.read()
    transcript: str | None = await SpeechService.transcribe_audio(content)

    if transcript is None:
        raise HTTPException(status_code=500, detail="Speech-to-text processing failed or returned no text")

    return {"text": transcript}
