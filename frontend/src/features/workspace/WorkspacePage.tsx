import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { PanelLeft, Home, FolderOpen, Pin, MoreHorizontal, Bot, FileDown, History, Share2, Copy, Check, X, GitBranch } from "lucide-react";
import { UIRoot } from "../ui_renderer/components/UIRoot.tsx";
import { useUIStore } from "../ui_renderer/store.ts";
import { useMarkGraphStore, fetchMarkGraphUI } from "../markgraph/store.ts";
import { MarkGraphRoot } from "../markgraph/components/MarkGraphRoot.tsx";
import { ChatPanel } from "../chat/components/ChatPanel.tsx";
import { TopicsSidebar } from "./components/TopicsSidebar.tsx";
import { HomeChatView } from "../home/components/HomeChatView.tsx";
import { useChatStore, sendChatMessage, loadChatHistory } from "../chat/hooks/useChat.ts";
import { useWorkspaceLayoutStore } from "./layoutStore.ts";
import { useTopicListStore } from "./hooks/useTopicList.ts";
import { KnowledgeGraphView } from "../knowledge-graph/components/KnowledgeGraphView.tsx";

export function WorkspacePage() {
  const { topicId: chatTopicId, clear: clearChat } = useChatStore();
  const { topicId: uiTopicId, uiJson: a2uiJson } = useUIStore();
  const { ast: markGraphAst, markdown: storedMarkdown, sceneId: currentSceneId } = useMarkGraphStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showKnowledgeGraph, setShowKnowledgeGraph] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const topics = useTopicListStore((s) => s.topics);
  const pinnedTopicIds = useTopicListStore((s) => s.pinnedTopicIds);
  const togglePin = useTopicListStore((s) => s.togglePin);
  const isSidebarCollapsed = useWorkspaceLayoutStore((s) => s.isSidebarCollapsed);
  const setSidebarCollapsed = useWorkspaceLayoutStore((s) => s.setSidebarCollapsed);
  const isChatCollapsed = useWorkspaceLayoutStore((s) => s.isChatCollapsed);
  const setChatCollapsed = useWorkspaceLayoutStore((s) => s.setChatCollapsed);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isHomeRoute = location.pathname === "/home";
  const isLoadingTopics = useTopicListStore((s) => s.isLoading);

  const versionHistory = useMarkGraphStore((s) => s.versionHistory);
  const fetchHistory = useMarkGraphStore((s) => s.fetchHistory);
  const rollbackVersion = useMarkGraphStore((s) => s.rollbackVersion);

  const activeTopic = topics.find((t) => t.topic_id === chatTopicId);
  const initialized = useRef(false);
  const restoredFromUrl = useRef(false);

  // Close knowledge graph whenever the active chat topic changes so that
  // it is rebuilt fresh for the new conversation when reopened.
  useEffect(() => {
    setShowKnowledgeGraph(false);
  }, [chatTopicId]);

  // Load UI when topic changes
  useEffect(() => {
    if (chatTopicId && chatTopicId !== uiTopicId) {
      // Actually fetchMarkGraphUI replaces fetchUIForTopic because the backend now returns MarkGraph
      // Store will populate both stores for fallback purposes
      fetchMarkGraphUI(chatTopicId);
    }
  }, [chatTopicId, uiTopicId]);

  // Restore selected topic from URL on refresh (when ?topic=xxx is present)
  useEffect(() => {
    if (location.pathname !== "/workspace") return;

    const topicIdFromUrl = searchParams.get("topic");
    if (!topicIdFromUrl) return;

    // Wait for topics to load before restore or clear — avoid clearing URL before fetch completes
    if (isLoadingTopics) return;
    if (topics.length === 0) {
      // No topics yet: either still loading (initial) or user has none — don't clear on initial state
      return;
    }

    const topicExists = topics.some((t) => t.topic_id === topicIdFromUrl);
    if (!topicExists) {
      // Topic deleted or invalid — clear param
      setSearchParams({}, { replace: true });
      return;
    }

    // Restore topic when store was reset (e.g. refresh)
    if (restoredFromUrl.current || chatTopicId != null) return;

    restoredFromUrl.current = true;
    const chatStore = useChatStore.getState();
    chatStore.setTopicId(topicIdFromUrl);
    loadChatHistory(topicIdFromUrl);
  }, [location.pathname, isLoadingTopics, chatTopicId, searchParams, topics, setSearchParams]);

  // Sync URL when topic is set from other sources (e.g. first message creates topic)
  useEffect(() => {
    if (location.pathname !== "/workspace" || !chatTopicId) return;
    if (searchParams.get("topic") === chatTopicId) return;
    setSearchParams({ topic: chatTopicId }, { replace: true });
  }, [location.pathname, chatTopicId, searchParams, setSearchParams]);

  // Handle initial topic from MenuPage (user selected a recommendation)
  useEffect(() => {
    if (location.state?.initialTopic && !initialized.current) {
      initialized.current = true;
      const topic = location.state.initialTopic;
      navigate("/workspace", { replace: true, state: {} });
      sendChatMessage(`Search the web and tell me about: ${topic}`);
    }
  }, [location.state, navigate]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [menuOpen]);

  useEffect(() => {
    if (!historyOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setHistoryOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [historyOpen]);

  useEffect(() => {
    if (historyOpen && chatTopicId) {
      fetchHistory(chatTopicId);
    }
  }, [historyOpen, chatTopicId, fetchHistory]);

  const handleExportMarkdown = () => {
    if (!storedMarkdown) return;
    const filename = `${activeTopic?.title?.replace(/[^\w\s-]/g, "") || "export"}.md`;
    const blob = new Blob([storedMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  };

  const createShareLink = useMarkGraphStore((s) => s.createShareLink);

  const handleShare = async () => {
    if (!currentSceneId) return;
    setIsSharing(true);
    const url = await createShareLink(currentSceneId);
    if (url) {
      // Prepend host if needed, but the backend returns /share/hash
      const fullUrl = `${window.location.protocol}//${window.location.host}${url}`;
      setShareUrl(fullUrl);
    }
    setIsSharing(false);
  };

  const handleCopyLink = () => {
    if (!shareUrl) return;
    void navigator.clipboard.writeText(shareUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[#F7F5F3] relative font-sans">
      {/* Left — Topics sidebar */}
      <TopicsSidebar />

      <div className="flex min-h-0 flex-1 flex-col md:flex-row overflow-hidden relative">
        {isHomeRoute ? (
          /* Home — AI Chat View (full canvas) — wrapper enforces height boundary for scroll */
          <div className="flex min-h-0 w-full flex-1 overflow-hidden">
            <HomeChatView />
          </div>
        ) : null}
        {!isHomeRoute && (
          <>
            {/* Center — Main UI Panel */}
            <div className="flex flex-1 flex-col overflow-hidden bg-[#FAF9F8]">
              {/* Top Bar */}
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#E0DEDB] bg-[#FAF9F8] px-4">
                <div className="flex items-center gap-2">
                  {isSidebarCollapsed && (
                    <>
                      <button
                        onClick={() => setSidebarCollapsed(false)}
                        className="cursor-pointer rounded-lg p-1.5 text-[#605A57] hover:bg-[rgba(55,50,47,0.08)] hover:text-[#37322F] transition-colors"
                        title="Expand Sidebar"
                      >
                        <PanelLeft size={18} />
                      </button>
                      <div className="h-4 w-px bg-[#E0DEDB] mx-1" />
                    </>
                  )}
                  <div className="flex items-center gap-1.5 text-sm font-medium text-[#605A57]">
                    <Home size={16} />
                    <button
                      onClick={() => { clearChat(); navigate("/home"); }}
                      className="cursor-pointer hover:text-[#37322F] transition-colors"
                    >
                      Workspace
                    </button>
                    {activeTopic && (
                      <>
                        <span className="text-[#E0DEDB] mx-0.5">/</span>
                        <FolderOpen size={16} className="text-[#37322F]" />
                        <span className="text-[#49423D] truncate max-w-[200px] sm:max-w-[300px] font-sans">{activeTopic.title}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleShare}
                    disabled={isSharing || !currentSceneId}
                    className="hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[#605A57] hover:bg-[rgba(55,50,47,0.08)] hover:text-[#37322F] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSharing ? "Sharing..." : "Share"}
                  </button>

                  <div ref={historyRef} className="relative">
                    <button
                      onClick={() => setHistoryOpen((o) => !o)}
                      className="rounded-lg p-1.5 text-[#605A57] hover:bg-[rgba(55,50,47,0.08)] hover:text-[#37322F] transition-colors cursor-pointer"
                      title="UI History"
                    >
                      <History size={18} />
                    </button>
                    {historyOpen && (
                      <div className="absolute right-0 top-full mt-1 w-64 max-h-80 overflow-y-auto bg-[#FAF9F8] border border-[#E0DEDB] rounded-lg shadow-lg z-50 py-1">
                        <div className="px-3 py-2 text-xs font-semibold text-[#605A57] border-b border-[#E0DEDB] mb-1">
                          Version History
                        </div>
                        {versionHistory.length === 0 ? (
                          <div className="px-3 py-4 text-center text-xs text-text-muted italic">
                            No history found
                          </div>
                        ) : (
                          versionHistory.map((v) => (
                            <button
                              key={v.scene_id}
                              onClick={() => {
                                if (chatTopicId) rollbackVersion(chatTopicId, v.scene_id);
                                setHistoryOpen(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-[rgba(55,50,47,0.06)] transition-colors group"
                            >
                              <div className="text-[13px] font-medium text-[#49423D] group-hover:text-[#37322F] truncate">
                                {v.description}
                              </div>
                              <div className="text-[11px] text-[#605A57]">
                                {new Date(v.created_at.endsWith("Z") || v.created_at.includes("+") ? v.created_at : v.created_at + "Z").toLocaleString()}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setShowKnowledgeGraph((v) => !v)}
                    disabled={!chatTopicId}
                    className={`rounded-lg p-1.5 transition-colors cursor-pointer disabled:opacity-40 ${
                      showKnowledgeGraph
                        ? "text-[#37322F] bg-[rgba(55,50,47,0.10)] hover:bg-[rgba(55,50,47,0.14)]"
                        : "text-[#605A57] hover:bg-[rgba(55,50,47,0.08)] hover:text-[#37322F]"
                    }`}
                    title="Knowledge Graph"
                  >
                    <GitBranch size={18} />
                  </button>

                  <button
                    onClick={() => chatTopicId && togglePin(chatTopicId)}
                    className={`rounded-lg p-1.5 transition-colors cursor-pointer ${
                      chatTopicId && pinnedTopicIds.includes(chatTopicId)
                        ? "text-red-500 hover:bg-red-50"
                        : "text-[#605A57] hover:bg-[rgba(55,50,47,0.08)] hover:text-[#37322F]"
                    }`}
                  >
                    <Pin size={18} fill={chatTopicId && pinnedTopicIds.includes(chatTopicId) ? "currentColor" : "none"} />
                  </button>
                  <div ref={menuRef} className="relative">
                    <button
                      onClick={() => setMenuOpen((o) => !o)}
                      className="rounded-lg p-1.5 text-[#605A57] hover:bg-[rgba(55,50,47,0.08)] hover:text-[#37322F] transition-colors cursor-pointer"
                      title="More options"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {menuOpen && (
                      <div className="absolute right-0 top-full mt-1 bg-[#FAF9F8] border border-[#E0DEDB] rounded-lg shadow-lg z-50 overflow-hidden">
                        <button
                          onClick={handleExportMarkdown}
                          disabled={!storedMarkdown}
                          className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px] text-[#49423D] hover:bg-[rgba(55,50,47,0.06)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap font-sans rounded-lg"
                        >
                          <FileDown size={14} />
                          Export to markdown
                        </button>
                      </div>
                    )}
                  </div>
                  {isChatCollapsed && (
                    <>
                      <div className="h-4 w-px bg-[#E0DEDB] mx-1" />
                      <button 
                        onClick={() => setChatCollapsed(false)}
                        className="rounded-lg p-1.5 text-[#605A57] hover:bg-[rgba(55,50,47,0.08)] hover:text-[#37322F] transition-colors cursor-pointer"
                        title="Expand AI Chat"
                      >
                        <Bot size={18} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {showKnowledgeGraph && chatTopicId ? (
                <KnowledgeGraphView
                  topicId={chatTopicId}
                  topicTitle={activeTopic?.title ?? ""}
                  onClose={() => setShowKnowledgeGraph(false)}
                />
              ) : (
                <main className="flex flex-1 flex-col overflow-y-auto workspace-scrollbar p-6">
                  {!chatTopicId ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                      <h2 className="text-2xl font-semibold text-[#49423D] font-sans">
                        Workspace
                      </h2>
                      <p className="max-w-md text-[#605A57] font-sans">
                        Start a conversation in the chat panel to generate a custom UI.
                      </p>
                    </div>
                  ) : (
                    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 pb-20 h-full relative">
                      {markGraphAst ? <MarkGraphRoot /> : (a2uiJson ? <UIRoot /> : null)}
                    </div>
                  )}
                </main>
              )}
            </div>

            {/* Right — Chat Panel */}
            <div 
              className={`shrink-0 bg-[#FAF9F8] flex flex-col z-20 transition-[width,height,opacity] duration-300 ease-in-out overflow-hidden ${
                isChatCollapsed 
                  ? "w-0 h-0 md:h-full opacity-0 border-none" 
                  : "w-full md:w-[400px] h-[50vh] md:h-full opacity-100 border-t md:border-t-0 md:border-l border-[#E0DEDB]"
              }`}
            >
              <div className="w-dvw md:w-[400px] h-[50vh] md:h-full flex flex-col">
                <ChatPanel inline={true} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Share Modal */}
      {shareUrl && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setShareUrl(null)}
          />
          <div className="relative w-full max-w-md scale-in-center overflow-hidden rounded-2xl bg-[#FAF9F8] p-6 shadow-2xl border border-[#E0DEDB] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-[#37322F]">
                <div className="rounded-lg bg-[rgba(55,50,47,0.08)] p-2">
                  <Share2 size={20} />
                </div>
                <h3 className="text-lg font-semibold font-sans">Share Revision</h3>
              </div>
              <button 
                onClick={() => setShareUrl(null)}
                className="rounded-lg p-1.5 text-[#605A57] hover:bg-[rgba(55,50,47,0.08)] hover:text-[#37322F] transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-[13px] text-[#605A57] mb-4 font-sans leading-relaxed">
              Anyone with this link can view this specific version of the interactive UI without logging in.
            </p>

            <div className="group relative mb-6">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="w-full rounded-xl border border-[#E0DEDB] bg-white px-4 py-3 pr-12 text-[13px] text-[#49423D] transition-colors focus:border-[#37322F] focus:outline-none focus:ring-1 focus:ring-[#37322F] font-sans"
              />
              <button
                onClick={handleCopyLink}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#605A57] hover:bg-[rgba(55,50,47,0.06)] hover:text-[#37322F] transition-colors"
                title="Copy link"
              >
                {copySuccess ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShareUrl(null)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-[#37322F] hover:bg-[#49423D] transition-all shadow-md active:scale-95 font-sans"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}