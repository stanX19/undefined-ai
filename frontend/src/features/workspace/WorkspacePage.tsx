import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { UIRoot } from "../ui_renderer/components/UIRoot.tsx";
import { useUIStore, fetchUIForTopic } from "../ui_renderer/store.ts";
import { ChatPanel } from "../chat/components/ChatPanel.tsx";
import { TopicsSidebar } from "./components/TopicsSidebar.tsx";
import { useChatStore, sendChatMessage } from "../chat/hooks/useChat.ts";

export function WorkspacePage() {
  const { topicId: chatTopicId } = useChatStore();
  const { topicId: uiTopicId } = useUIStore();

  const location = useLocation();
  const navigate = useNavigate();
  const initialized = useRef(false);

  // Load UI when topic changes
  useEffect(() => {
    if (chatTopicId && chatTopicId !== uiTopicId) {
      fetchUIForTopic(chatTopicId);
    }
  }, [chatTopicId, uiTopicId]);

  // Handle initial topic routing from history state
  useEffect(() => {
    if (location.state?.initialTopic && !initialized.current) {
      initialized.current = true;
      const topic = location.state.initialTopic;

      // Clear location state to prevent running again on refresh
      navigate(location.pathname, { replace: true, state: {} });

      // Pass the recommended topic to the chat
      sendChatMessage(`Search the web and tell me about: ${topic}`);
    }
  }, [location.state, location.pathname, navigate]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-(--color-bg)">
      {/* Left — Topics sidebar */}
      <TopicsSidebar />

      {/* Center — Main UI Panel */}
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
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-20">
            <UIRoot />
          </div>
        )}
      </main>

      {/* Right — Chat Panel */}
      <div className="w-[400px] shrink-0 border-l border-border bg-surface">
        <ChatPanel inline={true} />
      </div>
    </div>
  );
}