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

    Graph structure
    ---------------
    - Virtual root node  : the topic title (level -1), placed at centre by D3
    - Level-2 nodes      : compressed summaries — middle ring
    - Level-1 nodes      : atomic facts          — outer ring
    - Edges              : root→L2 and L2→L1 (or root→L1 when no L2 parent found)
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

    fact_id_set = {f.fact_id for f in facts}
    level2_ids = {f.fact_id for f in facts if f.level == 2}

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

    edges: list[KGEdge] = []
    connected_to_root: set[str] = set()

    for f in facts:
        if f.parent_fact_id and f.parent_fact_id in fact_id_set:
            # Level-1 → its level-2 parent that is also in our result set
            edges.append(KGEdge(source=f.parent_fact_id, target=f.fact_id))
        elif f.level == 2:
            # Level-2 with no in-set parent → connect to root
            edges.append(KGEdge(source="root", target=f.fact_id))
            connected_to_root.add(f.fact_id)

    # Any level-1 fact whose parent was a level-0 raw chunk (not in fact_id_set)
    # gets connected to root so the graph stays connected
    targeted = {e.target for e in edges}
    for f in facts:
        if f.fact_id not in targeted:
            edges.append(KGEdge(source="root", target=f.fact_id))

    return KnowledgeGraphResponse(topic_id=topic_id, nodes=nodes, edges=edges)
