export interface KGNode {
  id: string;
  label: string;        // Short display label
  full_content: string; // Full text shown in tooltip
  level: number;        // -1=root, 1=atomic fact, 2=compressed summary
}

export interface KGEdge {
  source: string;
  target: string;
}

export interface KnowledgeGraphData {
  topic_id: string;
  nodes: KGNode[];
  edges: KGEdge[];
}
