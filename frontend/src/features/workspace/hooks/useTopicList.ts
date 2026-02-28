import { create } from "zustand";
import { useAuthStore } from "../../auth/hooks/useAuthStore";

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
    setTopics: (topics: Topic[]) => void;
    setLoading: (loading: boolean) => void;
}

export const useTopicListStore = create<TopicListState>((set) => ({
    topics: [],
    isLoading: false,
    setTopics: (topics) => set({ topics }),
    setLoading: (isLoading) => set({ isLoading }),
}));

/**
 * Fetch all topics for the current user from GET /api/v1/topics/?user_id=
 */
export async function fetchTopics(): Promise<void> {
    const store = useTopicListStore.getState();
    const userId = useAuthStore.getState().userId;
    if (!userId) return;

    store.setLoading(true);
    try {
        const res = await fetch(`/api/v1/topics/?user_id=${encodeURIComponent(userId)}`);
        if (!res.ok) throw new Error("Failed to fetch topics");
        const data: Topic[] = await res.json();
        store.setTopics(data);
    } catch (err) {
        console.error("Failed to fetch topics:", err);
    } finally {
        store.setLoading(false);
    }
}
