"""Ingestion service — 4-stage pipeline that transforms document text into a fact hierarchy.

Stage 1: Chunk raw text (no LLM)
Stage 2: Extract atomic facts from chunks (LLM)
Stage 3: Compress atomic facts → main facts (LLM)
Stage 4: Compress main facts → core concepts (LLM)

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


# ── LLM prompt templates ────────────────────────────────────────────────────

_ATOMIC_SPLIT_PROMPT = """\
You are a knowledge extraction engine.

Given the following text chunk, extract ALL atomic facts from it.
An atomic fact is a single, self-contained piece of information that cannot be broken down further.

Rules:
- Each fact must be a complete, standalone sentence.
- Do NOT summarize — extract every distinct piece of information.
- Do NOT add information not present in the text.
- Return ONLY a JSON array of strings.

Text chunk:
\"\"\"
{chunk_text}
\"\"\"

Return JSON:
["fact 1", "fact 2", ...]
"""

_COMPRESS_PROMPT = """\
You are a knowledge compression engine.

Given the following list of facts, compress them into approximately {target_count} higher-level summary facts.
Each summary fact should capture the essence of multiple related input facts.

Rules:
- Preserve all important information.
- Each output fact must be a complete, standalone sentence.
- Group related facts together before summarizing.
- Return ONLY a JSON array of strings.

Input facts:
{facts_json}

Return JSON:
["summary fact 1", "summary fact 2", ...]
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
        """Execute all 4 stages sequentially."""
        from srcs.database import AsyncSessionLocal

        try:
            async with AsyncSessionLocal() as db:
                # Clear any previous facts for re-ingestion
                await db.execute(
                    delete(AtomicFact).where(AtomicFact.topic_id == topic_id)
                )
                await db.commit()

                # Stage 1: Chunk
                await IngestionService._emit_progress(topic_id, "stage_1", "Chunking document text…")
                chunks = IngestionService._stage_1_chunk(document_text)
                chunk_facts = await IngestionService._save_chunks(
                    db, topic_id, chunks, document_text,
                )

                # Stage 2: Atomic split
                _pipeline_status[topic_id] = "processing:stage_2"
                await IngestionService._emit_progress(topic_id, "stage_2", f"Extracting atomic facts ({len(chunk_facts)} chunks)…")
                atomic_facts = await IngestionService._stage_2_atomic_split(
                    db, topic_id, chunk_facts,
                )

                # Stage 3: First compression → main facts
                _pipeline_status[topic_id] = "processing:stage_3"
                await IngestionService._emit_progress(topic_id, "stage_3", f"Compressing to main facts ({len(atomic_facts)} facts)…")
                main_facts = await IngestionService._stage_3_compress(
                    db, topic_id, atomic_facts, target_count=len(atomic_facts), output_level=2,
                )

                # Stage 4: Second compression → core concepts
                _pipeline_status[topic_id] = "processing:stage_4"
                await IngestionService._emit_progress(topic_id, "stage_4", "Compressing to core concepts…")
                await IngestionService._stage_3_compress(
                    db, topic_id, main_facts, target_count=10, output_level=3,
                )

            _pipeline_status[topic_id] = "completed"
            await IngestionService._emit_progress(topic_id, "completed", "Ingestion complete.")
            print(f"[INGESTION] Pipeline completed for topic {topic_id}")

        except Exception as exc:
            traceback.print_exc()
            _pipeline_status[topic_id] = f"failed:{exc}"
            print(f"[INGESTION] Pipeline FAILED for topic {topic_id}: {exc}")

    # ── Stage 1: Chunking (no LLM) ──────────────────────────────────────

    @staticmethod
    def _stage_1_chunk(document_text: str) -> list[str]:
        """Split document text into paragraph-level chunks.

        Uses double-newline as the primary delimiter, with a fallback
        to split overly long paragraphs at ~2000 chars.
        """
        raw_paragraphs: list[str] = [
            p.strip() for p in document_text.split("\n\n") if p.strip()
        ]

        max_chunk_size: int = 2000
        chunks: list[str] = []
        for para in raw_paragraphs:
            if len(para) <= max_chunk_size:
                chunks.append(para)
                continue
            # Split long paragraphs on single newlines or sentence boundaries
            words: list[str] = para.split()
            current: list[str] = []
            current_len: int = 0
            for word in words:
                if current_len + len(word) + 1 > max_chunk_size and current:
                    chunks.append(" ".join(current))
                    current = []
                    current_len = 0
                current.append(word)
                current_len += len(word) + 1
            if current:
                chunks.append(" ".join(current))

        return chunks

    @staticmethod
    async def _save_chunks(
        db: AsyncSession,
        topic_id: str,
        chunks: list[str],
        document_text: str,
    ) -> list[AtomicFact]:
        """Persist level-0 chunks with source offsets."""
        facts: list[AtomicFact] = []
        search_start: int = 0

        for chunk_text in chunks:
            start_idx: int = document_text.find(chunk_text, search_start)
            end_idx: int = start_idx + len(chunk_text) if start_idx >= 0 else -1

            fact = AtomicFact(
                topic_id=topic_id,
                level=0,
                content=chunk_text,
                source_start=start_idx if start_idx >= 0 else None,
                source_end=end_idx if end_idx >= 0 else None,
            )
            db.add(fact)
            facts.append(fact)

            if start_idx >= 0:
                search_start = end_idx

        await db.flush()
        await db.commit()
        print(f"[INGESTION] Stage 1: created {len(facts)} chunks")
        return facts

    # ── Stage 2: Atomic split (LLM) ─────────────────────────────────────

    @staticmethod
    async def _extract_facts_from_chunk(
        chunk: AtomicFact,
    ) -> tuple[AtomicFact, list[str]]:
        """Send a single chunk to the LLM and return extracted fact strings."""
        prompt: str = _ATOMIC_SPLIT_PROMPT.format(chunk_text=chunk.content)
        response = await rotating_llm.send_message_get_json(
            prompt, temperature=0.0,
        )
        extracted: list[str] = response.json_data if isinstance(response.json_data, list) else []
        return chunk, extracted

    @staticmethod
    async def _stage_2_atomic_split(
        db: AsyncSession,
        topic_id: str,
        chunk_facts: list[AtomicFact],
    ) -> list[AtomicFact]:
        """Extract atomic facts from each chunk via LLM (parallel)."""
        results = await asyncio.gather(
            *(IngestionService._extract_facts_from_chunk(chunk) for chunk in chunk_facts)
        )

        all_atomic: list[AtomicFact] = []
        for chunk, extracted in results:
            for fact_text in extracted:
                if not isinstance(fact_text, str) or not fact_text.strip():
                    continue
                fact = AtomicFact(
                    topic_id=topic_id,
                    level=1,
                    content=fact_text.strip(),
                    source_chunk_id=chunk.fact_id,
                    source_start=chunk.source_start,
                    source_end=chunk.source_end,
                )
                db.add(fact)
                all_atomic.append(fact)

        await db.flush()
        await db.commit()
        print(f"[INGESTION] Stage 2: extracted {len(all_atomic)} atomic facts")
        return all_atomic

    # ── Stage 3 & 4: Compression (LLM) ──────────────────────────────────

    @staticmethod
    async def _compress_batch(
        batch: list[AtomicFact],
        per_batch_target: int,
    ) -> tuple[list[AtomicFact], list[str]]:
        """Send a single batch to the LLM and return summary strings."""
        facts_text: list[str] = [f.content for f in batch]
        prompt: str = _COMPRESS_PROMPT.format(
            target_count=per_batch_target,
            facts_json=str(facts_text),
        )
        response = await rotating_llm.send_message_get_json(
            prompt, temperature=0.0,
        )
        summaries: list[str] = response.json_data if isinstance(response.json_data, list) else []
        return batch, summaries

    @staticmethod
    def _batch_source_range(
        batch: list[AtomicFact],
    ) -> tuple[int | None, int | None]:
        """Compute min(source_start) and max(source_end) across facts in a batch."""
        starts = [f.source_start for f in batch if f.source_start is not None]
        ends = [f.source_end for f in batch if f.source_end is not None]
        return (min(starts) if starts else None, max(ends) if ends else None)

    @staticmethod
    async def _stage_3_compress(
        db: AsyncSession,
        topic_id: str,
        input_facts: list[AtomicFact],
        target_count: int,
        output_level: int,
    ) -> list[AtomicFact]:
        """Compress facts from one level into fewer facts at the next level (parallel)."""
        if not input_facts:
            return []

        # Batch size: process groups of facts together
        batch_size: int = max(50, len(input_facts) // max(1, target_count // 5))
        batches: list[list[AtomicFact]] = [
            input_facts[i:i + batch_size]
            for i in range(0, len(input_facts), batch_size)
        ]

        per_batch_target: int = max(1, target_count // max(1, len(batches)))

        results = await asyncio.gather(
            *(IngestionService._compress_batch(batch, per_batch_target) for batch in batches)
        )

        all_compressed: list[AtomicFact] = []
        for batch, summaries in results:
            parent_id: str = batch[0].fact_id
            source_chunk_id: str | None = batch[0].source_chunk_id
            src_start, src_end = IngestionService._batch_source_range(batch)

            for summary_text in summaries:
                if not isinstance(summary_text, str) or not summary_text.strip():
                    continue
                fact = AtomicFact(
                    topic_id=topic_id,
                    level=output_level,
                    content=summary_text.strip(),
                    parent_fact_id=parent_id,
                    source_chunk_id=source_chunk_id,
                    source_start=src_start,
                    source_end=src_end,
                )
                db.add(fact)
                all_compressed.append(fact)

        await db.flush()
        await db.commit()
        print(f"[INGESTION] Stage {output_level + 1}: compressed to {len(all_compressed)} level-{output_level} facts")
        return all_compressed
