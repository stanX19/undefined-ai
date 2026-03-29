"""Topic routes — CRUD + PDF upload."""
import os
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from srcs.config import get_settings
from srcs.database import get_db
from srcs.schemas.topic_dto import TopicCreateRequest, TopicResponse, TopicDetailResponse
from srcs.services.topic_service import TopicService
from srcs.services.document_service import DocumentService
from srcs.services.ingestion_service import IngestionService
from srcs.dependencies import get_current_user
from srcs.services.usage_service import UsageService
from srcs.models.user import User

router: APIRouter = APIRouter(prefix="/api/v1/topics", tags=["topics"])


@router.post("/", response_model=TopicResponse)
async def create_topic(
    body: TopicCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TopicResponse:
    """Create a new topic for a user."""
    topic = await TopicService.create_topic(db, current_user.user_id, body.title)
    return TopicResponse.model_validate(topic)


@router.get("/", response_model=list[TopicResponse])
async def list_topics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TopicResponse]:
    """List all topics for a user."""
    topics = await TopicService.get_user_topics(db, current_user.user_id)
    return [TopicResponse.model_validate(t) for t in topics]


@router.get("/{topic_id}", response_model=TopicDetailResponse)
async def get_topic(
    topic_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TopicDetailResponse:
    """Get a single topic with its document text."""
    topic = await TopicService.get_user_topic(db, topic_id, current_user.user_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return TopicDetailResponse.model_validate(topic)


@router.post("/{topic_id}/upload", response_model=TopicDetailResponse)
async def upload_document(
    topic_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TopicDetailResponse:
    """Upload a PDF, extract its text, and store it on the topic.

    Only PDF files are accepted.
    Automatically triggers the ingestion pipeline in the background.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    # Verify ownership
    topic = await TopicService.get_user_topic(db, topic_id, current_user.user_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    content: bytes = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    settings = get_settings()

    # Cheap PDF signature check before consuming quota.
    # Many non-PDF inputs will fail quickly here, avoiding extraction work and quota spend.
    if not content.lstrip().startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="Invalid PDF file")

    # Charge before expensive work so over-quota users don't trigger PDF I/O/extraction.
    await UsageService.check_and_consume_units(db, current_user, settings.UNIT_COST_INGESTION)
    file_path: str | None = None
    try:
        file_path = DocumentService.save_pdf(content, file.filename, settings.UPLOAD_DIR)
        extracted: str = DocumentService.extract_text(file_path)
    except RuntimeError as exc:
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass
        await UsageService.refund_units(db, current_user, settings.UNIT_COST_INGESTION)
        raise HTTPException(status_code=400, detail="Failed to process PDF file") from exc
    except Exception:
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass
        await UsageService.refund_units(db, current_user, settings.UNIT_COST_INGESTION)
        raise

    # Persist extracted content (non-blocking ingestion is triggered after persistence).
    try:
        topic = await TopicService.set_document_text(db, topic_id, extracted)
    except Exception:
        await db.rollback()
        await UsageService.safe_refund_units(db, current_user, settings.UNIT_COST_INGESTION)
        raise

    # Auto-trigger ingestion pipeline in background (non-blocking)
    IngestionService.trigger_ingestion(topic_id, extracted)

    return TopicDetailResponse.model_validate(topic)


@router.delete("/{topic_id}", status_code=204)
async def delete_topic(
    topic_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a specific topic if owned by the current user."""
    success = await TopicService.delete_user_topic(db, topic_id, current_user.user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Topic not found or unauthorized")
