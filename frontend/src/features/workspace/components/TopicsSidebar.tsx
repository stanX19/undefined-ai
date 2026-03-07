import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, MessageSquare, LogOut, PanelLeft, PanelLeftClose, Home, Network, MoreHorizontal, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
    useTopicListStore,
    fetchTopics,
} from "../hooks/useTopicList";
import { useChatStore, loadChatHistory } from "../../chat/hooks/useChat";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { useSurfaceStore } from "../../a2ui/store";
import { useWorkspaceLayoutStore } from "../layoutStore";

export function TopicsSidebar() {
    const topics = useTopicListStore((s) => s.topics);
    const isLoading = useTopicListStore((s) => s.isLoading);
    const currentTopicId = useChatStore((s) => s.topicId);
    const clearChat = useChatStore((s) => s.clear);
    const logout = useAuthStore((s) => s.logout);
    const navigate = useNavigate();

    const isCollapsed = useWorkspaceLayoutStore((s) => s.isSidebarCollapsed);
    const setIsCollapsed = useWorkspaceLayoutStore((s) => s.setSidebarCollapsed);
    const [isHovering, setIsHovering] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [sidebarWidth, setSidebarWidth] = useState(280);
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    // Responsive mobile check
    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) setIsCollapsed(true);
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Drag to resize logic
    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
    }, []);

    const resize = useCallback(
        (e: MouseEvent) => {
            if (isResizing) {
                const newWidth = e.clientX;
                if (newWidth >= 250 && newWidth <= 500) {
                    setSidebarWidth(newWidth);
                }
            }
        },
        [isResizing]
    );

    useEffect(() => {
        if (isResizing) {
            window.addEventListener("mousemove", resize);
            window.addEventListener("mouseup", stopResizing);
        }
        return () => {
            window.removeEventListener("mousemove", resize);
            window.removeEventListener("mouseup", stopResizing);
        };
    }, [isResizing, resize, stopResizing]);

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
        <>
            {/* Mobile Overlay Background */}
            {isMobile && !isCollapsed && (
                <div 
                    className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity" 
                    onClick={() => setIsCollapsed(true)}
                />
            )}

            <div
                ref={sidebarRef}
                className={`relative h-full shrink-0 ${!isResizing && "transition-[width] duration-300"} ${isMobile ? "absolute z-50" : ""} ${isCollapsed && !isMobile ? "w-0" : ""}`}
                style={{ width: (isCollapsed && !isMobile) ? 0 : (isMobile ? 280 : sidebarWidth) }}
                onMouseEnter={() => !isMobile && setIsHovering(true)}
                onMouseLeave={() => !isMobile && setIsHovering(false)}
            >
                {/* The invisible hover trigger area when collapsed */}
                {isCollapsed && !isMobile && (
                    <div className="absolute left-0 top-0 z-40 h-full w-4 cursor-pointer" />
                )}

                {/* Mobile floating toggle button when collapsed */}
                {isCollapsed && isMobile && (
                    <button
                        onClick={() => setIsCollapsed(false)}
                        className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md border border-gray-200 text-[#212529] hover:bg-gray-50"
                    >
                        <Menu size={20} />
                    </button>
                )}

                {/* The actual sidebar */}
                <div
                    className={`absolute left-0 top-0 z-30 flex h-full flex-col border-r border-border bg-white font-sans ${!isResizing && "transition-transform duration-300"} ${
                        isExpanded ? "translate-x-0" : "-translate-x-full"
                    } ${isCollapsed && isHovering && !isMobile ? "shadow-xl" : ""}`}
                    style={{ width: isMobile ? 280 : sidebarWidth }}
                >
                    {/* Header (Logo) & Actions */}
                <div className="flex items-center justify-between px-6 pt-8 pb-6">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="Logo" className="h-6 w-auto object-contain" />
                        <span className="text-[15px] font-medium text-[#212529]">My Workspace</span>
                    </div>
                    <button
                        onClick={() => {
                            setIsCollapsed(!isCollapsed);
                            setIsHovering(false);
                        }}
                        className="cursor-pointer rounded-lg p-1 text-gray-400 transition-colors hover:bg-[#d5fba8]/50 hover:text-[#212529]"
                        title={isCollapsed ? "Pin Sidebar" : "Collapse Sidebar"}
                    >
                        {isCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
                    </button>
                </div>

                {/* Main Links */}
                <div className="flex flex-col gap-1 px-4 mb-6">
                    <button 
                        onClick={() => navigate("/menu")}
                        className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-2.5 text-[14px] font-medium text-gray-600 transition-colors hover:bg-[#d5fba8]/30 hover:text-[#212529]"
                    >
                        <Home size={18} />
                        Home
                    </button>
                    <button 
                        className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-2.5 text-[14px] font-medium text-gray-600 transition-colors hover:bg-[#d5fba8]/30 hover:text-[#212529]"
                    >
                        <Network size={18} />
                        Knowledge graph
                    </button>
                </div>

                {/* Topics Header */}
                <div className="flex items-center justify-between px-6 pb-2">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Conversation</h3>
                    <button
                        onClick={handleNewTopic}
                        className="cursor-pointer rounded-lg p-1 text-gray-400 transition-colors hover:bg-[#d5fba8] hover:text-[#212529]"
                        title="New Topic"
                    >
                        <Plus size={16} />
                    </button>
                </div>

                {/* Topics list */}
                <div className="flex-1 overflow-y-auto px-4 pb-4 hide-scrollbar">
                    {isLoading && topics.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                            <span className="text-xs text-gray-400">Loading…</span>
                        </div>
                    ) : topics.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <p className="text-xs text-gray-400">
                                No topics yet. Start a chat!
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-0.5">
                            {topics.map((topic) => (
                                <button
                                    key={topic.topic_id}
                                    onClick={() => handleSelectTopic(topic.topic_id)}
                                    className={`group flex w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-2.5 text-left text-[14px] transition-colors ${
                                        topic.topic_id === currentTopicId
                                        ? "bg-[#d5fba8] font-medium text-[#212529]"
                                        : "text-gray-600 hover:bg-[#d5fba8]/30 hover:text-[#212529]"
                                    }`}
                                >
                                    <MessageSquare size={16} className={`shrink-0 ${topic.topic_id === currentTopicId ? "text-[#212529]" : "text-gray-400 group-hover:text-[#212529]"}`} />
                                    <span className="truncate">{topic.title}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer — User Info / Logout */}
                <div className="border-t border-gray-100 p-4">
                    <button
                        onClick={handleLogout}
                        className="flex w-full cursor-pointer items-center justify-between rounded-xl px-2 py-2 transition-colors hover:bg-gray-50"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-[#212529]">
                                M
                            </div>
                            <div className="flex flex-col items-start">
                                <span className="text-[13px] font-medium text-[#212529] leading-none">Marcus</span>
                            </div>
                        </div>
                        <LogOut size={16} className="text-gray-400 hover:text-red-500 transition-colors" />
                    </button>
                </div>

                {/* Resizer Handle */}
                {!isMobile && !isCollapsed && (
                    <div 
                        className="absolute -right-1.5 top-0 z-50 h-full w-3 cursor-col-resize hover:bg-[#d1fb9f]/50 transition-colors"
                        onMouseDown={startResizing}
                    />
                )}
            </div>
        </div>
        </>
    );
}
