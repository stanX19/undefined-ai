import { create } from "zustand";
import { apiFetch } from "../../constants/api";
import type { KnowledgeGraphData } from "./types";

interface KnowledgeGraphState {
  data: KnowledgeGraphData | null;
  isLoading: boolean;
  error: string | null;

  fetchGraph: (topicId: string, topicTitle: string) => Promise<void>;
  clear: () => void;
}

export const useKnowledgeGraphStore = create<KnowledgeGraphState>((set) => ({
  data: null,
  isLoading: false,
  error: null,

  fetchGraph: async (topicId: string, _topicTitle: string) => {
    set({ isLoading: true, error: null, data: null });
    try {
      // Use the dedicated knowledge-graph endpoint which builds the correct
      // root → level-2 → level-1 tree structure server-side.
      const res = await apiFetch(`/api/v1/knowledge-graph/${topicId}`);
      if (!res.ok) throw new Error("Failed to fetch knowledge graph");

      const data: KnowledgeGraphData = await res.json();
      set({ data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message ?? "Failed to load graph", isLoading: false });
    }
  },

  clear: () => set({ data: null, isLoading: false, error: null }),
}));
