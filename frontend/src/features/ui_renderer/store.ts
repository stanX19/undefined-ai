import { create } from "zustand";
import type { UIJson, UIElement } from "./types.ts";
import { apiFetch } from "../../constants/api";

interface UIState {
    sceneId: string | null;
    topicId: string | null;
    uiJson: UIJson | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    setUI: (topicId: string, sceneId: string, uiJson: UIJson) => void;
    patchUI: (updates: Partial<UIJson>) => void;
    updateElementState: (elementId: string, stateUpdate: Partial<UIElement["state"]>) => void;
    updateGlobalState: (path: string, value: any) => void;
    clear: () => void;
}

export const useUIStore = create<UIState>((set) => ({
    sceneId: null,
    topicId: null,
    uiJson: null,
    isLoading: false,
    error: null,

    setUI: (topicId, sceneId, uiJson) => set({ topicId, sceneId, uiJson, error: null }),

    patchUI: (updates) =>
        set((state) => {
            if (!state.uiJson) return state;
            return {
                uiJson: { ...state.uiJson, ...updates },
            };
        }),

    updateElementState: (elementId, stateUpdate) =>
        set((state) => {
            if (!state.uiJson || !state.uiJson.elements[elementId]) return state;
            const element = state.uiJson.elements[elementId];
            return {
                uiJson: {
                    ...state.uiJson,
                    elements: {
                        ...state.uiJson.elements,
                        [elementId]: { ...element, state: stateUpdate } as UIElement,
                    },
                },
            };
        }),

    updateGlobalState: (path, value) =>
        set((state) => {
            if (!state.uiJson) return state;
            const newGlobalState = { ...(state.uiJson.global_state || {}) };
            // very simple path split supported for 1 level deep currently
            // if we need lodash-like path setting we can add deeply later
            newGlobalState[path] = value;
            return {
                uiJson: { ...state.uiJson, global_state: newGlobalState },
            };
        }),

    clear: () => set({ sceneId: null, topicId: null, uiJson: null, error: null }),
}));

export async function fetchUIForTopic(topicId: string) {
    const store = useUIStore.getState();
    useUIStore.setState({ isLoading: true, error: null });
    try {
        const res = await apiFetch(`/api/v1/ui/${topicId}`);
        if (!res.ok) {
            throw new Error(`Failed to fetch UI: ${res.statusText}`);
        }
        const data = await res.json();
        store.setUI(data.topic_id, data.scene_id, data.ui_json);
    } catch (err) {
        console.error(err);
        useUIStore.setState({ error: (err as Error).message });
    } finally {
        useUIStore.setState({ isLoading: false });
    }
}
