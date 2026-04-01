import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Plus, MessageSquare, LogOut, PanelLeft, PanelLeftClose, Home, Network, Menu, Pin, MoreVertical, Trash2 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import {
    useTopicListStore,
    fetchTopics,
    deleteTopic,
} from "../hooks/useTopicList";
import { useChatStore, loadChatHistory } from "../../chat/hooks/useChat";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { useSurfaceStore } from "../../a2ui/store";
import { useUIStore } from "../../ui_renderer/store";
import { useMarkGraphStore } from "../../markgraph/store";
import { useWorkspaceLayoutStore } from "../layoutStore";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";

export function TopicsSidebar() {
    const topics = useTopicListStore((s) => s.topics);
    const pinnedTopicIds = useTopicListStore((s) => s.pinnedTopicIds);
    const isLoading = useTopicListStore((s) => s.isLoading);
    const currentTopicId = useChatStore((s) => s.topicId);
    const clearChat = useChatStore((s) => s.clear);

    const email = useAuthStore((s) => s.email);
    const username = useAuthStore((s) => s.username);
    const logout = useAuthStore((s) => s.logout);
    const navigate = useNavigate();
    const location = useLocation();
    const isHomeRoute = location.pathname === "/home";

    const isCollapsed = useWorkspaceLayoutStore((s) => s.isSidebarCollapsed);
    const setIsCollapsed = useWorkspaceLayoutStore((s) => s.setSidebarCollapsed);
    const [isHovering, setIsHovering] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [sidebarWidth, setSidebarWidth] = useState(280);
    const [isResizing, setIsResizing] = useState(false);
    const [openMenuTopicId, setOpenMenuTopicId] = useState<string | null>(null);
    const [topicToDelete, setTopicToDelete] = useState<string | null>(null);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

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

    useEffect(() => {
        if (!openMenuTopicId) return;
        const handleClickOutside = (e: MouseEvent) => {
            const el = e.target as HTMLElement;
            if (menuRef.current?.contains(el) || el.closest("[data-topic-menu-trigger]")) return;
            setOpenMenuTopicId(null);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [openMenuTopicId]);

    const handleSelectTopic = useCallback(
        (topicId: string) => {
            if (topicId === currentTopicId && location.pathname === "/workspace") return;

            const chatStore = useChatStore.getState();
            chatStore.clear();
            useSurfaceStore.getState().clearAll();
            useUIStore.getState().clear();
            useMarkGraphStore.getState().clear();
            chatStore.setTopicId(topicId);
            loadChatHistory(topicId);
            navigate(`/workspace?topic=${topicId}`, { replace: true });
        },
        [currentTopicId, location.pathname, navigate],
    );

    const handleNewTopic = useCallback(() => {
        clearChat();
        useSurfaceStore.getState().clearAll();
        useUIStore.getState().clear();
        useMarkGraphStore.getState().clear();
        navigate("/home");
    }, [clearChat, navigate]);

    const handleLogout = useCallback(() => {
        clearChat();
        logout();
        navigate("/login");
    }, [clearChat, logout, navigate]);

    const handleDeleteTopic = useCallback(
        async (topicId: string) => {
            const topicStore = useTopicListStore.getState();
            const chatStore = useChatStore.getState();
            const ok = await deleteTopic(topicId);
            setOpenMenuTopicId(null);
            if (!ok) return;
            if (topicId === currentTopicId) {
                chatStore.clear();
                useSurfaceStore.getState().clearAll();
                useUIStore.getState().clear();
                useMarkGraphStore.getState().clear();
                const remaining = topicStore.topics.filter((t) => t.topic_id !== topicId);
                const nextTopic = remaining[0];
                if (nextTopic) {
                    chatStore.setTopicId(nextTopic.topic_id);
                    loadChatHistory(nextTopic.topic_id);
                    navigate(`/workspace?topic=${nextTopic.topic_id}`, { replace: true });
                } else {
                    navigate("/home");
                }
            }
        },
        [currentTopicId, navigate]
    );

    const isExpanded = !isCollapsed || isHovering;

    const sortedTopics = useMemo(() => {
        return [...topics].sort((a, b) => {
            const aPinned = pinnedTopicIds.includes(a.topic_id);
            const bPinned = pinnedTopicIds.includes(b.topic_id);
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            return 0; // retain original order (assuming fetched order) otherwise
        });
    }, [topics, pinnedTopicIds]);

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
                        className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-[#FAF9F8] shadow-md border border-[#E0DEDB] text-[#49423D] hover:bg-orange-50"
                    >
                        <Menu size={20} />
                    </button>
                )}

                {/* The actual sidebar */}
                <div
                    className={`absolute left-0 top-0 z-30 flex h-full flex-col border-r border-[#E0DEDB] bg-[#FAF9F8] font-sans ${!isResizing && "transition-transform duration-300"} ${isExpanded ? "translate-x-0" : "-translate-x-full"
                        } ${isCollapsed && isHovering && !isMobile ? "shadow-xl" : ""}`}
                    style={{ width: isMobile ? 280 : sidebarWidth }}
                >
                    {/* Header (Logo) & Actions */}
                    <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#E0DEDB] px-6">
                        <div className="flex items-center gap-3">
                            <img src="/logo.png" alt="Logo" className="h-6 w-auto object-contain" />
                            <span className="text-[15px] font-medium text-[#49423D]">My Workspace</span>
                        </div>
                        <button
                            onClick={() => {
                                setIsCollapsed(!isCollapsed);
                                setIsHovering(false);
                            }}
                            className="cursor-pointer rounded-lg p-1 text-[#605A57] transition-colors hover:bg-orange-100 hover:text-[#37322F]"
                            title={isCollapsed ? "Pin Sidebar" : "Collapse Sidebar"}
                        >
                            {isCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
                        </button>
                    </div>

                    {/* Main Links */}
                    <div className="flex flex-col gap-1 px-4 mt-4 mb-6">
                        <button
                            onClick={() => {
                                clearChat();
                                useSurfaceStore.getState().clearAll();
                                navigate("/home");
                            }}
                            className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-2.5 text-[14px] font-medium transition-colors ${isHomeRoute
                                ? "bg-orange-100 ring-2 ring-orange-400/50 text-[#37322F]"
                                : "text-[#605A57] hover:bg-orange-50 hover:text-[#37322F]"
                                }`}
                        >
                            <Home size={18} />
                            Home
                        </button>
                        <button
                            className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-2.5 text-[14px] font-medium text-[#605A57] transition-colors hover:bg-orange-50 hover:text-[#37322F]"
                        >
                            <Network size={18} />
                            Knowledge Graph
                        </button>
                    </div>

                    {/* Topics Header — pr-6 aligns Plus with collapse icon column */}
                    <div className="relative z-60 flex items-center justify-between px-5.5 pb-2">
                        <h3 className="text-xs font-semibold text-[#605A57] uppercase tracking-wider">Conversation</h3>
                        <button
                            type="button"
                            onClick={handleNewTopic}
                            className="cursor-pointer rounded-lg p-1.5 text-[#605A57] transition-colors hover:bg-orange-100 hover:text-[#37322F] shrink-0"
                            title="New conversation"
                        >
                            <Plus size={16} />
                        </button>
                    </div>

                    {/* Topics list */}
                    <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4 hide-scrollbar">
                        {isLoading && topics.length === 0 ? (
                            <div className="flex items-center justify-center py-8">
                                <span className="text-xs text-[#605A57]">Loading…</span>
                            </div>
                        ) : topics.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <p className="text-xs text-[#605A57]">
                                    No topics yet. Start a chat!
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {sortedTopics.map((topic) => {
                                    const isPinned = pinnedTopicIds.includes(topic.topic_id);
                                    const isMenuOpen = openMenuTopicId === topic.topic_id;
                                    return (
                                        <div key={topic.topic_id} className="relative">
                                            <button
                                                onClick={() => handleSelectTopic(topic.topic_id)}
                                                className={`group flex w-full cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 text-left text-[14px] transition-colors ${topic.topic_id === currentTopicId && !isHomeRoute
                                                    ? "bg-orange-100 ring-2 ring-orange-400/50 font-medium text-[#37322F]"
                                                    : "text-[#605A57] hover:bg-orange-50 hover:text-[#37322F]"
                                                    }`}
                                            >
                                                {isPinned ? (
                                                    <Pin size={16} className={`shrink-0 ${topic.topic_id === currentTopicId && !isHomeRoute ? "text-red-500" : "text-red-400 group-hover:text-red-500"}`} fill="currentColor" />
                                                ) : (
                                                    <MessageSquare size={16} className={`shrink-0 ${topic.topic_id === currentTopicId && !isHomeRoute ? "text-[#37322F]" : "text-[#605A57] group-hover:text-[#37322F]"}`} />
                                                )}
                                                <span className="min-w-0 flex-1 truncate pr-1" title={topic.title}>{topic.title}</span>
                                                <button
                                                    type="button"
                                                    data-topic-menu-trigger
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenMenuTopicId(isMenuOpen ? null : topic.topic_id);
                                                    }}
                                                    className={`shrink-0 rounded-md p-1 text-[#605A57] transition-opacity hover:bg-orange-100 hover:text-[#37322F] ${isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                                                    aria-label="Topic options"
                                                >
                                                    <MoreVertical size={16} />
                                                </button>
                                            </button>
                                            {isMenuOpen && (
                                                <div
                                                    ref={menuRef}
                                                    className="absolute right-2 top-full z-50 mt-1 min-w-[100px] rounded-lg border border-[#E0DEDB] bg-white py-1 shadow-lg"
                                                    role="menu"
                                                >
                                                    <button
                                                        type="button"
                                                        role="menuitem"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setTopicToDelete(topic.topic_id);
                                                            setOpenMenuTopicId(null);
                                                        }}
                                                        className="flex w-[calc(100%-10px)] items-center gap-1.5 rounded-md px-2.5 py-1.5 ml-1 mr-2 text-[12px] text-red-600 transition-colors hover:bg-red-50"
                                                    >
                                                        <Trash2 size={12} />
                                                        Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer — User Info / Logout */}
                    <div className="border-t border-[#E0DEDB] p-4">
                        <button
                            onClick={handleLogout}
                            className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-2 transition-colors hover:bg-[rgba(55,50,47,0.06)]"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex shrink-0 h-8 w-8 items-center justify-center rounded-full bg-[#E0DEDB] text-sm font-bold text-[#37322F]">
                                    {username?.[0]?.toUpperCase() || email?.[0]?.toUpperCase() || "U"}
                                </div>
                                <div className="flex flex-col items-start min-w-0 pb-0.5">
                                    <span className="truncate text-[13px] font-medium text-[#49423D] leading-normal max-w-[150px]" title={username || email || "User"}>
                                        {username || email || "User"}
                                    </span>
                                </div>
                            </div>
                            <LogOut size={16} className="text-[#605A57] hover:text-red-500 transition-colors" />
                        </button>
                    </div>

                    {/* Resizer Handle — full sidebar height */}
                    {!isMobile && !isCollapsed && (
                        <div
                            className="absolute -right-1.5 top-0 h-full z-50 w-3 cursor-col-resize hover:bg-orange-100/50 transition-colors"
                            onMouseDown={startResizing}
                        />
                    )}
                </div>
            </div>

            <ConfirmDialog
                isOpen={!!topicToDelete}
                onClose={() => setTopicToDelete(null)}
                onConfirm={() => {
                    if (topicToDelete) {
                        handleDeleteTopic(topicToDelete);
                    }
                }}
                title="Delete Topic?"
                message="This will permanently delete this conversation and all its history. This action cannot be undone."
                confirmText="Delete"
                isDestructive
            />
        </>
    );
}
