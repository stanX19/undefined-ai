"""Knowledge Graph route — builds a per-topic graph from AtomicFacts."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from srcs.database import get_db
from srcs.dependencies import get_current_user
from srcs.models.atomic_fact import AtomicFact
from srcs.models.user import User
from srcs.services.topic_service import TopicService

router = APIRouter(prefix="/api/v1/knowledge-graph", tags=["Knowledge Graph"])


class KGNode(BaseModel):
    id: str
    label: str         # Short display label (≤80 chars)
    full_content: str  # Full text for tooltip
    level: int         # -1=virtual root, 1=atomic fact, 2=compressed summary


class KGEdge(BaseModel):
    source: str
    target: str


class KnowledgeGraphResponse(BaseModel):
    topic_id: str
    nodes: list[KGNode]
    edges: list[KGEdge]


def _short_label(text: str, max_len: int = 70) -> str:
    text = text.strip()
    return text if len(text) <= max_len else text[:max_len].rstrip() + "…"


@router.get("/{topic_id}", response_model=KnowledgeGraphResponse)
async def get_knowledge_graph(
    topic_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the knowledge graph for a topic as nodes + edges.

    Graph structure (top-down tree)
    --------------------------------
    - Virtual root node  : the topic title (level -1), placed at centre by D3
    - Level-2 nodes      : compressed summaries — middle ring
    - Level-1 nodes      : atomic facts          — outer ring

    Edge strategy
    -------------
    1. root → every level-2 summary
    2. level-2 → level-1: use parent_fact_id when set; otherwise distribute
       level-1 facts round-robin across level-2 summaries so the graph is
       always a proper tree rather than a flat star.
    3. When no level-2 summaries exist: root → all level-1 facts directly.
    """
    topic = await TopicService.get_user_topic(db, topic_id, current_user.user_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    result = await db.execute(
        select(AtomicFact).where(
            AtomicFact.topic_id == topic_id,
            AtomicFact.level.in_([1, 2]),
        )
    )
    facts = result.scalars().all()

    root = KGNode(
        id="root",
        label=_short_label(topic.title, 40),
        full_content=topic.title,
        level=-1,
    )

    if not facts:
        return KnowledgeGraphResponse(topic_id=topic_id, nodes=[root], edges=[])

    nodes: list[KGNode] = [root]
    for f in facts:
        nodes.append(
            KGNode(
                id=f.fact_id,
                label=_short_label(f.content),
                full_content=f.content,
                level=f.level,
            )
        )

    level2_facts = [f for f in facts if f.level == 2]
    level1_facts = [f for f in facts if f.level == 1]
    level2_id_set = {f.fact_id for f in level2_facts}

    edges: list[KGEdge] = []

    if level2_facts:
        # root → every level-2 summary
        for l2 in level2_facts:
            edges.append(KGEdge(source="root", target=l2.fact_id))

        # level-2 → level-1
        # Prefer explicit parent_fact_id relationship when the ingestion pipeline
        # has set it (future-proof). Fall back to round-robin for existing data
        # where parent_fact_id is null on all facts.
        assigned: set[str] = set()
        for l1 in level1_facts:
            if l1.parent_fact_id and l1.parent_fact_id in level2_id_set:
                edges.append(KGEdge(source=l1.parent_fact_id, target=l1.fact_id))
                assigned.add(l1.fact_id)

        # Round-robin: distribute any unassigned level-1 facts across level-2 nodes
        unassigned = [f for f in level1_facts if f.fact_id not in assigned]
        for i, l1 in enumerate(unassigned):
            parent = level2_facts[i % len(level2_facts)]
            edges.append(KGEdge(source=parent.fact_id, target=l1.fact_id))
    else:
        # No summaries yet — flat: root → all level-1 facts
        for l1 in level1_facts:
            edges.append(KGEdge(source="root", target=l1.fact_id))

    return KnowledgeGraphResponse(topic_id=topic_id, nodes=nodes, edges=edges)
