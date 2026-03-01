"""Recommendation service -- LLM-powered topic suggestions based on user progress.

Uses the user's latest topic and its classified difficulty level to suggest
three new related topics at same level, +1 harder, and +2 harder.
Also provides classify_difficulty() for tagging material during ingestion.
"""
import json

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from srcs.models.topic import Topic
from srcs.models.topic_progress import TopicProgress
from srcs.models.atomic_fact import AtomicFact
from srcs.services.agents.cached_llm import cached_llm as rotating_llm

_DIFFICULTY_LABELS = {
    1: "kindergarten",
    2: "primary school",
    3: "secondary school",
    4: "undergraduate",
    5: "graduate",
    6: "PhD / research",
}

_CLASSIFY_PROMPT = """\
You are an academic difficulty classifier.

Given the following document text, classify its difficulty level on a 1-6 scale:
1 = kindergarten
2 = primary school
3 = secondary school
4 = undergraduate
5 = graduate
6 = PhD / research

Consider vocabulary complexity, assumed prerequisites, and depth of reasoning.

Document (first 3000 chars):
\"\"\"
{text}
\"\"\"

Return ONLY a JSON object: {{"difficulty": <integer 1-6>}}
"""

_RECOMMEND_PROMPT = """\
You are an educational advisor.

A user is currently studying the topic below. Based on the topic's content and \
difficulty level, suggest exactly 3 new topics they should explore next:

1. One topic at the SAME difficulty level ({same_label}, level {same})
2. One topic ONE level harder ({plus1_label}, level {plus1})
3. One topic TWO levels harder ({plus2_label}, level {plus2})

Current topic: "{title}"
Difficulty: {difficulty} ({difficulty_label})
Core concepts the user has covered:
{concepts}

Rules:
- Each suggestion must be a distinct topic (not a subtopic of the current one).
- Suggestions should be RELATED or complementary to the current material.
- Provide a short reason (1 sentence) for why each topic is relevant.
- Return ONLY a JSON array of exactly 3 objects.

Return JSON:
[
  {{"title": "...", "difficulty": {same}, "reason": "..."}},
  {{"title": "...", "difficulty": {plus1}, "reason": "..."}},
  {{"title": "...", "difficulty": {plus2}, "reason": "..."}}
]
"""

_DEFAULT_RECOMMEND_PROMPT = """\
You are an educational advisor.

A user has just joined an AI learning platform and hasn't explored any topics yet.
Their education level is "{education_level}".
Suggest exactly 3 diverse, introductory topics appropriate for this education level.
These could be from science, history, technology, or humanities.

Rules:
- Each suggestion must be distinct and engaging.
- Provide a short reason (1 sentence) for why each topic is a great starting point.
- Return ONLY a JSON array of exactly 3 objects.

Return JSON:
[
  {{"title": "...", "difficulty": <integer 2-4>, "reason": "..."}},
  ...
]
"""


class RecommendationService:
    """LLM-driven topic recommendation engine."""

    @staticmethod
    async def classify_difficulty(text: str) -> int:
        """Classify material difficulty (1-6) using the LLM.

        Returns an integer 1-6, defaulting to 4 if parsing fails.
        """
        truncated = text[:3000]
        prompt = _CLASSIFY_PROMPT.format(text=truncated)

        try:
            response = await rotating_llm.send_message_get_json(
                prompt, temperature=0.0, model="MiniMax-M2.5",
            )
            if isinstance(response.json_data, dict):
                level = int(response.json_data.get("difficulty", 4))
                return max(1, min(6, level))
        except Exception as exc:
            print(f"[RECOMMENDATION] classify_difficulty failed: {exc}")

        return 4

    @staticmethod
    async def get_recommendations(
        db: AsyncSession,
        user_id: str,
        topic_id: str,
    ) -> list[dict]:
        """Generate 3 topic suggestions based on the user's current topic.

        Returns a list of dicts: [{"title", "difficulty", "reason"}, ...]
        """
        topic = await db.get(Topic, topic_id)
        if not topic:
            return []

        difficulty = topic.difficulty_level or 4
        same = difficulty
        plus1 = min(difficulty + 1, 6)
        plus2 = min(difficulty + 2, 6)

        max_level = await RecommendationService._get_max_level(db, topic_id)
        concepts = await RecommendationService._get_top_facts(
            db, topic_id, max_level,
        )
        concepts_text = "\n".join(f"- {c}" for c in concepts) if concepts else "(no facts extracted yet)"

        prompt = _RECOMMEND_PROMPT.format(
            title=topic.title,
            difficulty=difficulty,
            difficulty_label=_DIFFICULTY_LABELS.get(difficulty, "unknown"),
            same=same,
            same_label=_DIFFICULTY_LABELS.get(same, "unknown"),
            plus1=plus1,
            plus1_label=_DIFFICULTY_LABELS.get(plus1, "unknown"),
            plus2=plus2,
            plus2_label=_DIFFICULTY_LABELS.get(plus2, "unknown"),
            concepts=concepts_text,
        )

        try:
            response = await rotating_llm.send_message_get_json(
                prompt, temperature=0.7, model="MiniMax-M2.5",
            )
            if isinstance(response.json_data, list):
                return [
                    {
                        "title": item.get("title", ""),
                        "difficulty": item.get("difficulty", same),
                        "reason": item.get("reason", ""),
                    }
                    for item in response.json_data[:3]
                    if isinstance(item, dict)
                ]
        except Exception as exc:
            print(f"[RECOMMENDATION] get_recommendations failed: {exc}")

        return []

    @staticmethod
    async def get_default_recommendations(education_level: str) -> list[dict]:
        """Generate 3 introductory topics for a new user based on their education level.

        Returns a list of dicts: [{"title", "difficulty", "reason"}, ...]
        """
        prompt = _DEFAULT_RECOMMEND_PROMPT.format(education_level=education_level)

        try:
            response = await rotating_llm.send_message_get_json(
                prompt, temperature=0.9, model="MiniMax-M2.5",
            )
            if isinstance(response.json_data, list):
                return [
                    {
                        "title": item.get("title", ""),
                        "difficulty": item.get("difficulty", 3),
                        "reason": item.get("reason", ""),
                    }
                    for item in response.json_data[:3]
                    if isinstance(item, dict)
                ]
        except Exception as exc:
            print(f"[RECOMMENDATION] get_default_recommendations failed: {exc}")

        return []

    @staticmethod
    async def update_progress(
        db: AsyncSession,
        user_id: str,
        topic_id: str,
        last_fact_id: str | None = None,
    ) -> TopicProgress:
        """Create or update the user's progress record for a topic."""
        from datetime import datetime, timezone

        result = await db.execute(
            select(TopicProgress).where(
                TopicProgress.user_id == user_id,
                TopicProgress.topic_id == topic_id,
            )
        )
        progress = result.scalar_one_or_none()

        if progress:
            if last_fact_id is not None:
                progress.last_fact_id = last_fact_id
            progress.last_accessed = datetime.now(timezone.utc)
        else:
            progress = TopicProgress(
                user_id=user_id,
                topic_id=topic_id,
                last_fact_id=last_fact_id,
            )
            db.add(progress)

        await db.commit()
        await db.refresh(progress)
        return progress

    # -- Private helpers ----------------------------------------------------------

    @staticmethod
    async def _get_max_level(db: AsyncSession, topic_id: str) -> int:
        result = await db.execute(
            select(func.max(AtomicFact.level))
            .where(AtomicFact.topic_id == topic_id)
        )
        return result.scalar_one_or_none() or 0

    @staticmethod
    async def _get_top_facts(
        db: AsyncSession, topic_id: str, level: int,
    ) -> list[str]:
        """Return fact content strings at the given level."""
        if level < 1:
            return []
        result = await db.execute(
            select(AtomicFact.content)
            .where(AtomicFact.topic_id == topic_id, AtomicFact.level == level)
            .order_by(AtomicFact.created_at.asc())
        )
        return list(result.scalars().all())
