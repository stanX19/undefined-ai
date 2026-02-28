import { useEffect, useCallback } from "react";
import { Plus, MessageSquare, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
    useTopicListStore,
    fetchTopics,
} from "../hooks/useTopicList";
import { useChatStore, loadChatHistory } from "../../chat/hooks/useChat";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { useSurfaceStore } from "../../a2ui/store";

export function TopicsSidebar() {
    const topics = useTopicListStore((s) => s.topics);
    const isLoading = useTopicListStore((s) => s.isLoading);
    const currentTopicId = useChatStore((s) => s.topicId);
    const clearChat = useChatStore((s) => s.clear);
    const logout = useAuthStore((s) => s.logout);
    const navigate = useNavigate();

    useEffect(() => {
        fetchTopics();
    }, []);

    const handleSelectTopic = useCallback(
        (topicId: string) => {
            if (topicId === currentTopicId) return;

            // Clear current chat & surfaces, then load the selected topic
            const chatStore = useChatStore.getState();
            chatStore.clear();
            useSurfaceStore.getState().clearAll();
            chatStore.setTopicId(topicId);
            loadChatHistory(topicId);
        },
        [currentTopicId],
    );

    const handleNewTopic = useCallback(() => {
        clearChat();
        useSurfaceStore.getState().clearAll();
    }, [clearChat]);

    const handleLogout = useCallback(() => {
        clearChat();
        logout();
        navigate("/login");
    }, [clearChat, logout, navigate]);

    return (
        <div className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-surface">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-text-primary">Topics</h2>
                <button
                    onClick={handleNewTopic}
                    className="cursor-pointer rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-alt hover:text-text-primary"
                    title="New Topic"
                >
                    <Plus size={16} />
                </button>
            </div>

            {/* Topics list */}
            <div className="flex-1 overflow-y-auto p-2">
                {isLoading && topics.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                        <span className="text-xs text-text-muted">Loading…</span>
                    </div>
                ) : topics.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                        <MessageSquare size={20} className="text-text-muted" />
                        <p className="text-xs text-text-muted">
                            No topics yet. Start a chat!
                        </p>
                    </div>
                ) : (
                    topics.map((topic) => (
                        <button
                            key={topic.topic_id}
                            onClick={() => handleSelectTopic(topic.topic_id)}
                            className={`mb-1 flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors ${topic.topic_id === currentTopicId
                                ? "bg-primary/10 font-medium text-primary"
                                : "text-text-secondary hover:bg-surface-alt"
                                }`}
                        >
                            <MessageSquare size={14} className="shrink-0" />
                            <span className="truncate">{topic.title}</span>
                        </button>
                    ))
                )}
            </div>

            {/* Footer — Logout */}
            <div className="border-t border-border p-2">
                <button
                    onClick={handleLogout}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] text-text-muted transition-colors hover:bg-surface-alt hover:text-text-primary"
                >
                    <LogOut size={14} />
                    Sign out
                </button>
            </div>
        </div>
    );
}
