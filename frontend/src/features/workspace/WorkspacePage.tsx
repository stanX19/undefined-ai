import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PanelLeft, Home, FolderOpen, Pin, MoreHorizontal, Bot, FileDown } from "lucide-react";
import { UIRoot } from "../ui_renderer/components/UIRoot.tsx";
import { useUIStore } from "../ui_renderer/store.ts";
import { useMarkGraphStore, fetchMarkGraphUI } from "../markgraph/store.ts";
import { MarkGraphRoot } from "../markgraph/components/MarkGraphRoot.tsx";
import { ChatPanel } from "../chat/components/ChatPanel.tsx";
import { TopicsSidebar } from "./components/TopicsSidebar.tsx";
import { HomeChatView } from "../home/components/HomeChatView.tsx";
import { useChatStore, sendChatMessage } from "../chat/hooks/useChat.ts";
import { useWorkspaceLayoutStore } from "./layoutStore.ts";
import { useTopicListStore } from "./hooks/useTopicList.ts";

export function WorkspacePage() {
  const { topicId: chatTopicId, clear: clearChat } = useChatStore();
  const { topicId: uiTopicId, uiJson: a2uiJson } = useUIStore();
  const { ast: markGraphAst, markdown: storedMarkdown } = useMarkGraphStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const topics = useTopicListStore((s) => s.topics);
  const pinnedTopicIds = useTopicListStore((s) => s.pinnedTopicIds);
  const togglePin = useTopicListStore((s) => s.togglePin);
  const isSidebarCollapsed = useWorkspaceLayoutStore((s) => s.isSidebarCollapsed);
  const setSidebarCollapsed = useWorkspaceLayoutStore((s) => s.setSidebarCollapsed);
  const isChatCollapsed = useWorkspaceLayoutStore((s) => s.isChatCollapsed);
  const setChatCollapsed = useWorkspaceLayoutStore((s) => s.setChatCollapsed);
  const location = useLocation();
  const isHomeRoute = location.pathname === "/home";

  const activeTopic = topics.find((t) => t.topic_id === chatTopicId);
  const navigate = useNavigate();
  const initialized = useRef(false);

  // Load UI when topic changes
  useEffect(() => {
    if (chatTopicId && chatTopicId !== uiTopicId) {
      // Actually fetchMarkGraphUI replaces fetchUIForTopic because the backend now returns MarkGraph
      // Store will populate both stores for fallback purposes
      fetchMarkGraphUI(chatTopicId);
    }
  }, [chatTopicId, uiTopicId]);

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
                  <button className="hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[#605A57] hover:bg-[rgba(55,50,47,0.08)] hover:text-[#37322F] transition-colors cursor-pointer">
                    Share
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
                      <div className="absolute right-0 top-full mt-1 py-0.5 bg-[#FAF9F8] border border-[#E0DEDB] rounded-lg shadow-lg z-50">
                        <button
                          onClick={handleExportMarkdown}
                          disabled={!storedMarkdown}
                          className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px] text-[#49423D] hover:bg-[rgba(55,50,47,0.06)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap font-sans"
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
    </div>
  );
}