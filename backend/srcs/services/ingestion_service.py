"""Ingestion service -- iterative compression pipeline for document knowledge.

Stage 1: Save raw document text (no LLM)
Stage 2: Extract atomic facts from the full document (LLM)
Stage 3+: Iteratively compress level-N facts into level N+1 until condensed

The pipeline runs as a background ``asyncio`` task triggered after PDF upload.
The final level N is dynamic -- large documents produce more levels.
"""
import asyncio
import traceback

from sqlalchemy.ext.asyncio import AsyncSession

from srcs.models.atomic_fact import AtomicFact
from srcs.schemas.chat_dto import SseIngestionProgressData
from srcs.services.agents.cached_llm import cached_llm as rotating_llm
from srcs.services.sse_service import SseService


# -- In-memory status tracking (POC) ---------------------------------------------
_pipeline_status: dict[str, str] = {}  # topic_id -> status string

# -- Stop condition for the compression loop --------------------------------------
_MIN_FACTS_TO_COMPRESS = 4  # stop compressing when <= this many facts remain


# -- LLM prompt templates ---------------------------------------------------------

_EXTRACT_FACTS_PROMPT = """\
You are a knowledge extraction engine.

Given the following document text, extract the core facts from it.
A fact is a single, self-contained piece of meaningful information.

Rules:
- Each fact must be a complete, standalone sentence.
- Focus on distinct, important information -- skip trivial or redundant details.
- Do NOT add information not present in the text.
- Return ONLY a JSON array of strings.

Document:
\"\"\"
{document_text}
\"\"\"

Return JSON:
["fact 1", "fact 2", ...]
"""

_COMPRESS_FACTS_PROMPT = """\
You are a knowledge compression engine.

Given the following list of facts, merge and compress them into fewer, \
higher-level summary facts. Combine related facts, remove redundancy, \
and preserve the most important information.

Rules:
- Each output fact must be a complete, standalone sentence.
- The output MUST have strictly fewer facts than the input.
- Aim to roughly halve the number of facts.
- Do NOT add information not present in the input facts.
- Return ONLY a JSON array of strings.

Input facts:
{facts_json}

Return JSON:
["compressed fact 1", "compressed fact 2", ...]
"""


class IngestionService:
    """Manages the ingestion pipeline lifecycle."""

    # -- Public API ---------------------------------------------------------------

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

    # -- Pipeline runner ----------------------------------------------------------

    @staticmethod
    async def _run_pipeline(topic_id: str, document_text: str) -> None:
        """Execute the iterative pipeline: save raw text -> extract -> compress loop."""
        from srcs.database import AsyncSessionLocal

        try:
            async with AsyncSessionLocal() as db:
                # Stage 1: Save raw document as a single level-0 chunk
                await IngestionService._emit_progress(topic_id, "stage_1", "Saving document...")
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

                # Stage 2: Extract atomic facts from the raw text
                current_level = 1
                _pipeline_status[topic_id] = f"processing:level_{current_level}"
                await IngestionService._emit_progress(
                    topic_id, f"level_{current_level}", "Extracting atomic facts...",
                )
                current_facts = await IngestionService._extract_facts(db, topic_id, chunk)

                # Stage 3+: Iteratively compress until condensed
                while len(current_facts) > _MIN_FACTS_TO_COMPRESS:
                    current_level += 1
                    _pipeline_status[topic_id] = f"processing:level_{current_level}"
                    await IngestionService._emit_progress(
                        topic_id,
                        f"level_{current_level}",
                        f"Compressing {len(current_facts)} facts -> level {current_level}...",
                    )
                    compressed = await IngestionService._compress_facts(
                        db, topic_id, current_level, current_facts,
                    )
                    # Guard: stop if compression didn't reduce the count
                    if len(compressed) >= len(current_facts):
                        print(f"[INGESTION] Compression stalled at level {current_level}, stopping")
                        break
                    current_facts = compressed

                # Cross-tree: merge across knowledge trees if combined count exceeds threshold
                await IngestionService._cross_tree_compress(db, topic_id)

            _pipeline_status[topic_id] = "completed"
            await IngestionService._emit_progress(topic_id, "completed", "Ingestion complete.")
            print(f"[INGESTION] Pipeline completed for topic {topic_id} (max level {current_level})")

        except Exception as exc:
            traceback.print_exc()
            _pipeline_status[topic_id] = f"failed:{exc}"
            print(f"[INGESTION] Pipeline FAILED for topic {topic_id}: {exc}")

    # -- Fact extraction (level 0 -> level 1) ------------------------------------

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
        print(f"[INGESTION] Level 1: extracted {len(facts)} atomic facts")
        return facts

    # -- Fact compression (level N -> level N+1) ---------------------------------

    @staticmethod
    async def _compress_facts(
        db: AsyncSession,
        topic_id: str,
        target_level: int,
        source_facts: list[AtomicFact],
    ) -> list[AtomicFact]:
        """Compress a list of facts into fewer higher-level facts."""
        import json

        facts_json = json.dumps([f.content for f in source_facts], indent=2)
        prompt = _COMPRESS_FACTS_PROMPT.format(facts_json=facts_json)
        response = await rotating_llm.send_message_get_json(
            prompt, temperature=0.0,
        )
        compressed: list[str] = response.json_data if isinstance(response.json_data, list) else []

        new_facts: list[AtomicFact] = []
        for fact_text in compressed:
            if not isinstance(fact_text, str) or not fact_text.strip():
                continue
            fact = AtomicFact(
                topic_id=topic_id,
                level=target_level,
                content=fact_text.strip(),
                source_chunk_id=source_facts[0].source_chunk_id,
                source_start=0,
                source_end=source_facts[0].source_end or 0,
            )
            db.add(fact)
            new_facts.append(fact)

        await db.flush()
        await db.commit()
        print(f"[INGESTION] Level {target_level}: compressed {len(source_facts)} -> {len(new_facts)} facts")
        return new_facts

    # -- Cross-tree compression (merges across multiple knowledge trees) ----------

    @staticmethod
    async def _cross_tree_compress(
        db: AsyncSession, topic_id: str,
    ) -> None:
        """Merge facts across knowledge trees when their combined count exceeds threshold.

        After each individual tree is fully compressed, this method checks the
        current max level: if the total number of facts there (summed across all
        trees) exceeds ``_MIN_FACTS_TO_COMPRESS``, it compresses them into a new
        higher level.  The process repeats until the top level is small enough.
        """
        from srcs.services.retrieval_service import RetrievalService

        max_level = await RetrievalService.get_max_level(db, topic_id)
        if max_level is None or max_level < 1:
            return

        current_level = max_level
        while True:
            facts = await RetrievalService.get_facts_by_level(db, topic_id, current_level)
            if len(facts) <= _MIN_FACTS_TO_COMPRESS:
                break

            await IngestionService._emit_progress(
                topic_id,
                f"cross_tree_{current_level + 1}",
                f"Cross-tree compression: {len(facts)} facts at level {current_level} → level {current_level + 1}…",
            )

            compressed = await IngestionService._compress_facts(
                db, topic_id, current_level + 1, facts,
            )

            if len(compressed) >= len(facts):
                print(f"[INGESTION] Cross-tree compression stalled at level {current_level}, stopping")
                break

            print(
                f"[INGESTION] Cross-tree: level {current_level} ({len(facts)}) "
                f"-> level {current_level + 1} ({len(compressed)})"
            )
            current_level += 1
