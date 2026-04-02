import { create } from "zustand";
import { apiFetch } from "../../constants/api";
import type { KnowledgeGraphData, KGNode, KGEdge } from "./types";

interface AtomicFactResponse {
  fact_id: string;
  topic_id: string;
  level: number;
  content: string;
  parent_fact_id: string | null;
}

interface KnowledgeGraphState {
  data: KnowledgeGraphData | null;
  isLoading: boolean;
  error: string | null;

  fetchGraph: (topicId: string, topicTitle: string) => Promise<void>;
  clear: () => void;
}

function shortLabel(text: string, max = 70): string {
  const t = text.trim();
  return t.length <= max ? t : t.slice(0, max).trimEnd() + "…";
}

export const useKnowledgeGraphStore = create<KnowledgeGraphState>((set) => ({
  data: null,
  isLoading: false,
  error: null,

  fetchGraph: async (topicId: string, topicTitle: string) => {
    set({ isLoading: true, error: null, data: null });
    try {
      // Use existing ingestion endpoints — fetch level-1 and level-2 facts in parallel
      const [res1, res2] = await Promise.all([
        apiFetch(`/api/v1/ingestion/${topicId}/facts?level=1`),
        apiFetch(`/api/v1/ingestion/${topicId}/facts?level=2`),
      ]);
      if (!res1.ok || !res2.ok) throw new Error("Failed to fetch facts");

      const [level1, level2]: [AtomicFactResponse[], AtomicFactResponse[]] =
        await Promise.all([res1.json(), res2.json()]);

      const allFacts = [...level2, ...level1];
      const factIdSet = new Set(allFacts.map((f) => f.fact_id));

      // Virtual root node
      const root: KGNode = {
        id: "root",
        label: shortLabel(topicTitle, 40),
        full_content: topicTitle,
        level: -1,
      };

      const nodes: KGNode[] = [
        root,
        ...allFacts.map((f) => ({
          id: f.fact_id,
          label: shortLabel(f.content),
          full_content: f.content,
          level: f.level,
        })),
      ];

      const edges: KGEdge[] = [];
      const targeted = new Set<string>();

      for (const f of allFacts) {
        if (f.parent_fact_id && factIdSet.has(f.parent_fact_id)) {
          edges.push({ source: f.parent_fact_id, target: f.fact_id });
          targeted.add(f.fact_id);
        }
      }

      // Anything not yet connected → link to root
      for (const f of allFacts) {
        if (!targeted.has(f.fact_id)) {
          edges.push({ source: "root", target: f.fact_id });
        }
      }

      set({ data: { topic_id: topicId, nodes, edges }, isLoading: false });
    } catch (err: any) {
      set({ error: err.message ?? "Failed to load graph", isLoading: false });
    }
  },

  clear: () => set({ data: null, isLoading: false, error: null }),
}));
