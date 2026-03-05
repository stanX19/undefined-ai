import { create } from "zustand";
import type { MarkGraphAST } from "./types.ts";

interface MarkGraphState {
    sceneId: string | null;
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

    clear: () => void;
}

export const useMarkGraphStore = create<MarkGraphState>((set) => ({
    sceneId: null,
    topicId: null,
    ast: null,
    markdown: null,
    isLoading: false,
    error: null,
    scrollTarget: null,
    history: [],

    setUI: (topicId, sceneId, ast, markdown) => 
        set({ topicId, sceneId, ast, markdown, error: null, scrollTarget: null, history: [] }),

    navigateScene: (targetId) => 
        set((state) => {
            if (!state.ast) return state;

            // 1. Find which scene contains this targetId
            let foundSceneId = state.sceneId; // default to current

            // Helper to recursively check if a container or element has the ID
            const hasId = (node: any, id: string): boolean => {
                if (node.id === id || node.explicit_id === id) return true;
                if (node.children) {
                    return node.children.some((child: any) => hasId(child, id));
                }
                return false;
            };

            for (const scene of state.ast.scenes) {
                if (scene.id === targetId || hasId(scene, targetId)) {
                    foundSceneId = scene.id;
                    break;
                }
            }

            const newHistory = [...state.history];
            // Only push to history if we are actually changing scenes
            if (foundSceneId !== state.sceneId) {
                newHistory.push(state.sceneId!);
            }

            return { 
                sceneId: foundSceneId,
                history: newHistory,
                scrollTarget: { id: targetId, ts: Date.now() }
            };
        }),

    goBack: () => 
        set((state) => {
            if (state.history.length === 0) return state;
            
            const newHistory = [...state.history];
            const prevSceneId = newHistory.pop();
            
            return {
                sceneId: prevSceneId,
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

    clear: () => set({ sceneId: null, topicId: null, ast: null, markdown: null, error: null, history: [] }),
}));

export async function fetchMarkGraphUI(topicId: string) {
    const store = useMarkGraphStore.getState();
    useMarkGraphStore.setState({ isLoading: true, error: null });
    try {
        const res = await fetch(`/api/v1/ui/${topicId}`);
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
