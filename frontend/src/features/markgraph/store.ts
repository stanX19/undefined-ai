import { create } from "zustand";
import type { MarkGraphAST } from "./types.ts";
import { apiFetch } from "../../constants/api";

export interface UIHistoryItem {
    scene_id: string;
    created_at: string;
    description: string;
}

interface MarkGraphState {
    sceneId: string | null;   // Database UUID
    viewId: string | null;    // Local MarkGraph scene ID (e.g. "root-scene")
    topicId: string | null;
    ast: MarkGraphAST | null;
    markdown: string | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    setUI: (topicId: string, sceneId: string, ast: MarkGraphAST, markdown: string) => void;
    navigateScene: (targetId: string) => void;
    goBack: () => void;
    scrollTarget: { id: string; ts: number } | null;
    history: string[]; // Stack of scene IDs

    // For reactive state
    updateSignal: (elementId: string, value: any) => void;

    // History
    versionHistory: UIHistoryItem[];
    fetchHistory: (topicId: string) => Promise<void>;
    rollbackVersion: (topicId: string, sceneId: string) => Promise<void>;

    // Sharing
    createShareLink: (sceneId: string) => Promise<string | null>;
    fetchPublicUI: (token: string) => Promise<void>;

    clear: () => void;
}

export const useMarkGraphStore = create<MarkGraphState>((set) => ({
    sceneId: null,
    viewId: null,
    topicId: null,
    ast: null,
    markdown: null,
    isLoading: false,
    error: null,
    scrollTarget: null,
    history: [],

    setUI: (topicId, sceneId, ast, markdown) => {
        const firstSceneId = ast.scenes && ast.scenes.length > 0 ? ast.scenes[0].id : null;
        set({ topicId, sceneId, viewId: firstSceneId, ast, markdown, error: null, scrollTarget: null, history: [] });
    },

    navigateScene: (targetId) =>
        set((state) => {
            if (!state.ast) return state;

            // 1. Find which scene contains this targetId
            let foundSceneId = state.sceneId; // default to current

            // Helper to recursively check if a container or element has the ID
            const hasId = (node: any, id: string): boolean => {
                if (node.id === id || node.explicit_id === id) return true;
                if (node.inline_texts && node.inline_texts[id]) return true;
                if (node.children) {
                    return node.children.some((child: any) => hasId(child, id));
                }
                return false;
            };

            let matchedViaFallback = false;
            // Track whether Stage 1 made any definitive match (even into the current scene).
            // Stages 2 and 3 are fuzzy fallbacks and must NOT run if Stage 1 already
            // resolved the target — otherwise Jaccard can hijack a correct intra-scene
            // scroll and redirect the user to a completely different scene.
            let stage1Found = false;

            // Stage 1: exact match on scene.id or any child element id
            for (const scene of state.ast.scenes) {
                if (scene.id === targetId || hasId(scene, targetId)) {
                    foundSceneId = scene.id;
                    stage1Found = true;
                    break;
                }
            }

            // Stage 2: try targetId + "-scene" suffix (legacy headings).
            // Only runs when Stage 1 found nothing at all.
            if (!stage1Found) {
                const withSceneSuffix = targetId.endsWith("-scene") ? targetId : `${targetId}-scene`;
                for (const scene of state.ast.scenes) {
                    if (scene.id === withSceneSuffix) {
                        foundSceneId = scene.id;
                        matchedViaFallback = true;
                        break;
                    }
                }
            }

            // Stage 3: Jaccard word-overlap fuzzy match.
            // LLM-generated markdown uses abbreviated anchors (#os-quiz) that don't
            // exactly match auto-derived scene slugs (operating-systems-quiz).
            // Jaccard (intersection / union) correctly ranks candidates when two scenes
            // share the same number of matching words with the target — e.g.
            //   os-quiz vs os-history-and-evolution  → 1/5 = 0.20
            //   os-quiz vs operating-systems-quiz    → 1/4 = 0.25  ← correct winner
            // Only runs when both Stage 1 AND Stage 2 found nothing.
            if (!stage1Found && foundSceneId === state.sceneId) {
                const targetWords = new Set(targetId.split("-"));
                let bestScore = 0;
                let bestId: string | null = null;
                for (const scene of state.ast.scenes) {
                    const sceneWords = new Set(scene.id.split("-"));
                    const common = [...targetWords].filter(w => sceneWords.has(w)).length;
                    if (common === 0) continue;
                    const union = new Set([...targetWords, ...sceneWords]).size;
                    const score = common / union; // Jaccard
                    if (score > bestScore) {
                        bestScore = score;
                        bestId = scene.id;
                    }
                }
                if (bestScore >= 0.15 && bestId) {
                    foundSceneId = bestId;
                    matchedViaFallback = true;
                }
            }

            const newHistory = [...state.history];
            // Only push to history if we are actually changing scenes
            if (foundSceneId !== state.sceneId) {
                newHistory.push(state.sceneId!);
            }

            // Scene sections use id={scene.id}; when resolved via fallback, targetId won't match DOM—use foundSceneId
            const scrollId: string = matchedViaFallback && foundSceneId ? foundSceneId : targetId;

            return {
                viewId: foundSceneId,
                history: newHistory,
                scrollTarget: { id: scrollId, ts: Date.now() }
            };
        }),

    goBack: () =>
        set((state) => {
            if (state.history.length === 0) return state;

            const newHistory = [...state.history];
            const prevSceneId = newHistory.pop();

            return {
                viewId: prevSceneId,
                history: newHistory,
                scrollTarget: null // Clear scroll target when going back
            };
        }),

    updateSignal: (elementId, value) =>
        set((state) => {
            if (!state.ast) return state;

            // Note: In MarkGraph, user interactions (checking a box, picking quiz answer)
            // will need to update the AST id_map element to re-render properly. 
            // The renderer components should read from id_map or directly from the tree,
            // but updating deeply nested tree elements is hard. Since our parser populates
            // id_map, we can mutate id_map directly, or we can deep clone logic.
            // For now, let's deep clone the id_map for reactivity:

            const newIdMap = { ...state.ast.id_map };
            if (newIdMap[elementId]) {
                const node = newIdMap[elementId];
                if (node.type === "CheckboxBlock") {
                    // value is { idx: number, checked: boolean }
                    node.items = [...node.items];
                    node.items[value.idx] = [value.checked, node.items[value.idx][1]];
                } else if (node.type === "QuizBlock") {
                    node.user_answer_idx = value;
                } else if (node.type === "InputBlock") {
                    node.user_text = value;
                }
            }

            return {
                ast: { ...state.ast, id_map: newIdMap }
            };
        }),

    versionHistory: [],

    fetchHistory: async (topicId) => {
        try {
            const res = await apiFetch(`/api/v1/ui/${topicId}/history`);
            if (!res.ok) throw new Error("Failed to fetch history");
            const data = await res.json();
            set({ versionHistory: data.versions });
        } catch (err) {
            console.error(err);
        }
    },

    rollbackVersion: async (topicId, sceneId) => {
        try {
            const res = await apiFetch(`/api/v1/ui/${topicId}/rollback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scene_id: sceneId }),
            });
            if (!res.ok) throw new Error("Failed to rollback");
            const data = await res.json();
            // Update UI with the rolled back version
            const store = useMarkGraphStore.getState();
            store.setUI(data.topic_id, data.scene_id, data.ui_json, data.ui_markdown);
        } catch (err) {
            console.error(err);
        }
    },

    createShareLink: async (sceneId) => {
        try {
            const res = await apiFetch(`/api/v1/ui/share/${sceneId}`, {
                method: "POST",
            });
            if (!res.ok) throw new Error("Failed to create share link");
            const data = await res.json();
            return data.share_url;
        } catch (err) {
            console.error(err);
            return null;
        }
    },

    fetchPublicUI: async (token) => {
        set({ isLoading: true, error: null });
        try {
            const res = await apiFetch(`/api/v1/ui/public/${token}`);
            if (!res.ok) throw new Error("Failed to fetch public UI");
            const data = await res.json();
            const firstSceneId = data.ui_json.scenes && data.ui_json.scenes.length > 0 ? data.ui_json.scenes[0].id : null;
            set({ 
                topicId: data.topic_id, 
                sceneId: data.scene_id, 
                viewId: firstSceneId,
                ast: data.ui_json, 
                markdown: data.ui_markdown,
                error: null,
                isLoading: false
            });
        } catch (err) {
            console.error(err);
            set({ error: (err as Error).message, isLoading: false });
        }
    },

    clear: () => set({ sceneId: null, viewId: null, topicId: null, ast: null, markdown: null, error: null, history: [], versionHistory: [] }),
}));

export async function fetchMarkGraphUI(topicId: string) {
    const store = useMarkGraphStore.getState();
    useMarkGraphStore.setState({ isLoading: true, error: null });
    try {
        const res = await apiFetch(`/api/v1/ui/${topicId}`);
        if (!res.ok) {
            throw new Error(`Failed to fetch UI: ${res.statusText}`);
        }
        const data = await res.json();
        store.setUI(data.topic_id, data.scene_id, data.ui_json, data.ui_markdown);
    } catch (err) {
        console.error(err);
        useMarkGraphStore.setState({ error: (err as Error).message });
    } finally {
        useMarkGraphStore.setState({ isLoading: false });
    }
}
