"""Ingestion service — single-call pipeline that extracts core facts from document text.

Stage 1: Save raw document text (no LLM)
Stage 2: Extract core facts from the full document in one LLM call

The pipeline runs as a background ``asyncio`` task triggered after PDF upload.
"""
import asyncio
import traceback

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from srcs.models.atomic_fact import AtomicFact
from srcs.schemas.chat_dto import SseIngestionProgressData
from srcs.services.agents.rotating_llm import rotating_llm
from srcs.services.sse_service import SseService


# ── In-memory status tracking (POC) ─────────────────────────────────────────
_pipeline_status: dict[str, str] = {}  # topic_id → status string


# ── LLM prompt template ─────────────────────────────────────────────────────

_EXTRACT_FACTS_PROMPT = """\
You are a knowledge extraction engine.

Given the following document text, extract the core facts from it.
A fact is a single, self-contained piece of meaningful information.

Rules:
- Each fact must be a complete, standalone sentence.
- Focus on distinct, important information — skip trivial or redundant details.
- Do NOT add information not present in the text.
- Aim for at most 10 facts. Fewer is fine for short documents.
- Return ONLY a JSON array of strings.

Document:
\"\"\"
{document_text}
\"\"\"

Return JSON:
["fact 1", "fact 2", ...]
"""


class IngestionService:
    """Manages the ingestion pipeline lifecycle."""

    # ── Public API ───────────────────────────────────────────────────────

    @staticmethod
    def trigger_ingestion(topic_id: str, document_text: str) -> None:
        """Kick off the pipeline as a background task. Returns immediately."""
        _pipeline_status[topic_id] = "processing"
        asyncio.create_task(
            IngestionService._run_pipeline(topic_id, document_text)
        )

    @staticmethod
    def get_status(topic_id: str) -> str:
        """Return the current pipeline status for a topic."""
        return _pipeline_status.get(topic_id, "pending")

    @staticmethod
    async def _emit_progress(topic_id: str, stage: str, message: str) -> None:
        """Emit an SSE progress event if the stream is open."""
        if SseService.is_open(topic_id):
            await SseService.emit(
                topic_id,
                SseIngestionProgressData(topic_id=topic_id, stage=stage, message=message),
            )

    # ── Pipeline runner ──────────────────────────────────────────────────

    @staticmethod
    async def _run_pipeline(topic_id: str, document_text: str) -> None:
        """Execute the two-stage pipeline: save raw text, then extract facts."""
        from srcs.database import AsyncSessionLocal

        try:
            async with AsyncSessionLocal() as db:
                # Clear any previous facts for re-ingestion
                await db.execute(
                    delete(AtomicFact).where(AtomicFact.topic_id == topic_id)
                )
                await db.commit()

                # Stage 1: Save raw document as a single level-0 chunk
                await IngestionService._emit_progress(topic_id, "stage_1", "Saving document…")
                chunk = AtomicFact(
                    topic_id=topic_id,
                    level=0,
                    content=document_text,
                    source_start=0,
                    source_end=len(document_text),
                )
                db.add(chunk)
                await db.flush()
                await db.commit()
                print(f"[INGESTION] Stage 1: saved raw document ({len(document_text)} chars)")

                # Stage 2: Extract core facts in a single LLM call
                _pipeline_status[topic_id] = "processing:stage_2"
                await IngestionService._emit_progress(topic_id, "stage_2", "Extracting core facts…")
                await IngestionService._extract_facts(db, topic_id, chunk)

            _pipeline_status[topic_id] = "completed"
            await IngestionService._emit_progress(topic_id, "completed", "Ingestion complete.")
            print(f"[INGESTION] Pipeline completed for topic {topic_id}")

        except Exception as exc:
            traceback.print_exc()
            _pipeline_status[topic_id] = f"failed:{exc}"
            print(f"[INGESTION] Pipeline FAILED for topic {topic_id}: {exc}")

    # ── Fact extraction (single LLM call) ────────────────────────────────

    @staticmethod
    async def _extract_facts(
        db: AsyncSession,
        topic_id: str,
        chunk: AtomicFact,
    ) -> list[AtomicFact]:
        """Send the full document to the LLM and persist extracted facts."""
        prompt: str = _EXTRACT_FACTS_PROMPT.format(document_text=chunk.content)
        response = await rotating_llm.send_message_get_json(
            prompt, temperature=0.0,
        )
        extracted: list[str] = response.json_data if isinstance(response.json_data, list) else []

        facts: list[AtomicFact] = []
        for fact_text in extracted:
            if not isinstance(fact_text, str) or not fact_text.strip():
                continue
            fact = AtomicFact(
                topic_id=topic_id,
                level=1,
                content=fact_text.strip(),
                source_chunk_id=chunk.fact_id,
                source_start=0,
                source_end=len(chunk.content),
            )
            db.add(fact)
            facts.append(fact)

        await db.flush()
        await db.commit()
        print(f"[INGESTION] Stage 2: extracted {len(facts)} core facts")
        return facts
