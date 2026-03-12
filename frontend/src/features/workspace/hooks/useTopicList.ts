import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { apiFetch } from "../../../constants/api";

export interface Topic {
    topic_id: string;
    user_id: string;
    title: string;
    difficulty_level: number | null;
    created_at: string;
}

interface TopicListState {
    topics: Topic[];
    isLoading: boolean;
    pinnedTopicIds: string[];
    setTopics: (topics: Topic[]) => void;
    setLoading: (loading: boolean) => void;
    togglePin: (topicId: string) => void;
}

export const useTopicListStore = create<TopicListState>()(
    persist(
        (set) => ({
            topics: [],
            isLoading: false,
            pinnedTopicIds: [],
            setTopics: (topics) => set({ topics }),
            setLoading: (isLoading) => set({ isLoading }),
            togglePin: (topicId) => set((state) => ({
                pinnedTopicIds: state.pinnedTopicIds.includes(topicId)
                    ? state.pinnedTopicIds.filter((id) => id !== topicId)
                    : [...state.pinnedTopicIds, topicId]
            })),
        }),
        {
            name: "topic-list-storage",
            partialize: (state) => ({ pinnedTopicIds: state.pinnedTopicIds }), // Only persist pins
        }
    )
);

/**
 * Delete a topic via DELETE /api/v1/topics/{topic_id}. Updates local state on success.
 */
export async function deleteTopic(topicId: string): Promise<boolean> {
    const store = useTopicListStore.getState();
    const accessToken = useAuthStore.getState().accessToken;
    if (!accessToken) return false;

    try {
        const res = await apiFetch(`/api/v1/topics/${topicId}`, { method: "DELETE" });
        if (!res.ok) return false;
        store.setTopics(store.topics.filter((t) => t.topic_id !== topicId));
        return true;
    } catch (err) {
        console.error("Failed to delete topic:", err);
        return false;
    }
}

/**
 * Fetch all topics for the current user from GET /api/v1/topics/
 */
export async function fetchTopics(): Promise<void> {
    const store = useTopicListStore.getState();
    const accessToken = useAuthStore.getState().accessToken;
    if (!accessToken) return;

    store.setLoading(true);
    try {
        const res = await apiFetch(`/api/v1/topics/`);
        if (!res.ok) throw new Error("Failed to fetch topics");
        const data: Topic[] = await res.json();
        store.setTopics(data);
    } catch (err) {
        console.error("Failed to fetch topics:", err);
    } finally {
        store.setLoading(false);
    }
}
