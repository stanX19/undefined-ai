import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PanelLeft, Home, FolderOpen, Pin, Star, MoreHorizontal, Sparkles } from "lucide-react";
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
  const { topicId: chatTopicId } = useChatStore();
  const { topicId: uiTopicId, uiJson: a2uiJson } = useUIStore();
  const { ast: markGraphAst } = useMarkGraphStore();
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

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-bg relative">
      {/* Left — Topics sidebar */}
      <TopicsSidebar />

      <div className="flex flex-1 flex-col md:flex-row overflow-hidden relative">
        {isHomeRoute ? (
          /* Home — AI Chat View (full canvas) */
          <HomeChatView />
        ) : (
          <>
            {/* Center — Main UI Panel */}
            <div className="flex flex-1 flex-col overflow-hidden bg-[#fafafa]">
              {/* Top Bar */}
              <div className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3 shrink-0">
                <div className="flex items-center gap-2">
                  {isSidebarCollapsed && (
                    <>
                      <button
                        onClick={() => setSidebarCollapsed(false)}
                        className="cursor-pointer rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#212529] transition-colors"
                        title="Expand Sidebar"
                      >
                        <PanelLeft size={18} />
                      </button>
                      <div className="h-4 w-px bg-gray-200 mx-1" />
                    </>
                  )}
                  <div className="flex items-center gap-1.5 text-sm font-medium text-gray-500">
                    <Home size={16} />
                    <button
                      onClick={() => navigate("/home")}
                      className="cursor-pointer hover:text-[#212529] transition-colors"
                    >
                      Workspace
                    </button>
                    {activeTopic && (
                      <>
                        <span className="text-gray-300 mx-0.5">/</span>
                        <FolderOpen size={16} className="text-[#212529]" />
                        <span className="text-[#212529] truncate max-w-[200px] sm:max-w-[300px]">{activeTopic.title}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="hidden sm:flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-[#212529] transition-colors cursor-pointer">
                    Share
                  </button>
                  <button 
                    onClick={() => chatTopicId && togglePin(chatTopicId)}
                    className={`rounded-lg p-1.5 transition-colors cursor-pointer ${
                      chatTopicId && pinnedTopicIds.includes(chatTopicId)
                        ? "text-red-500 hover:bg-red-50"
                        : "text-gray-400 hover:bg-gray-100 hover:text-[#212529]"
                    }`}
                  >
                    <Pin size={18} fill={chatTopicId && pinnedTopicIds.includes(chatTopicId) ? "currentColor" : "none"} />
                  </button>
                  <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#212529] transition-colors cursor-pointer">
                    <Star size={18} />
                  </button>
                  <button className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[#212529] transition-colors cursor-pointer">
                    <MoreHorizontal size={18} />
                  </button>
                  {isChatCollapsed && (
                    <>
                      <div className="h-4 w-px bg-gray-200 mx-1" />
                      <button 
                        onClick={() => setChatCollapsed(false)}
                        className="rounded-lg p-1.5 text-[#212529] hover:bg-gray-100 transition-colors cursor-pointer"
                        title="Expand AI Chat"
                      >
                        <Sparkles size={18} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <main className="flex flex-1 flex-col overflow-y-auto workspace-scrollbar p-6">
                {!chatTopicId ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                    <h2 className="text-2xl font-semibold text-text-primary">
                      Workspace
                    </h2>
                    <p className="max-w-md text-text-muted">
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
              className={`shrink-0 bg-surface flex flex-col z-20 transition-[width,height,opacity] duration-300 ease-in-out overflow-hidden ${
                isChatCollapsed 
                  ? "w-0 h-0 md:h-full opacity-0 border-none" 
                  : "w-full md:w-[400px] h-[50vh] md:h-full opacity-100 border-t md:border-t-0 md:border-l border-border"
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