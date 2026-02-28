import { useState, useEffect, useCallback } from "react";
import { Plus, MessageSquare, LogOut, PanelLeft, PanelLeftClose } from "lucide-react";
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

    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isHovering, setIsHovering] = useState(false);

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

    const isExpanded = !isCollapsed || isHovering;

    return (
        <div
            className={`relative h-full shrink-0 transition-[width] duration-300 ${isCollapsed ? "w-0" : "w-64"}`}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            {/* The invisible hover trigger area when collapsed */}
            {isCollapsed && (
                <div className="absolute left-0 top-0 z-40 h-full w-4 cursor-pointer" />
            )}

            {/* The actual sidebar */}
            <div
                className={`absolute left-0 top-0 z-30 flex h-full w-64 flex-col border-r border-border bg-surface transition-transform duration-300 ${isExpanded ? "translate-x-0" : "-translate-x-full"
                    } ${isCollapsed && isHovering ? "shadow-xl" : ""}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <h2 className="text-sm font-semibold text-text-primary">Conversations</h2>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleNewTopic}
                            className="cursor-pointer rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-alt hover:text-text-primary"
                            title="New Topic"
                        >
                            <Plus size={16} />
                        </button>
                        <button
                            onClick={() => {
                                setIsCollapsed(!isCollapsed);
                                setIsHovering(false);
                            }}
                            className="cursor-pointer rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-alt hover:text-text-primary"
                            title={isCollapsed ? "Pin Sidebar" : "Collapse Sidebar"}
                        >
                            {isCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
                        </button>
                    </div>
                </div>

                {/* Topics list */}
                <div className="flex-1 overflow-y-auto p-2">
                    {isLoading && topics.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                            <span className="text-xs text-text-muted">Loading…</span>
                        </div>
                    ) : topics.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
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
        </div>
    );
}
