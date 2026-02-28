import { create } from "zustand";
import { useAuthStore } from "../../auth/hooks/useAuthStore.ts";
import { useSurfaceStore } from "../../a2ui/store.ts";
import { fallbackParse } from "../../a2ui/fallbackParser.ts";
import { fetchTopics } from "../../workspace/hooks/useTopicList.ts";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  attachments?: Array<{ name: string; type: string; url: string }>;
}

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  topicId: string | null;
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void;
  setStreaming: (streaming: boolean) => void;
  setTopicId: (topicId: string | null) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  topicId: null,

  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { ...msg, id: crypto.randomUUID(), timestamp: Date.now() },
      ],
    })),

  setStreaming: (isStreaming) => set({ isStreaming }),
  setTopicId: (topicId) => set({ topicId }),
  clear: () => set({ messages: [], isStreaming: false, topicId: null }),
}));

/**
 * Open an SSE connection for a given session (topic) and handle incoming events.
 * Fire-and-forget — the connection establishes in the background.
 */
function openSseStream(sessionId: string): void {
  const store = useChatStore.getState();
  const surfaceStore = useSurfaceStore.getState();

  const url = `/api/v1/chat/stream/${sessionId}`;
  const eventSource = new EventSource(url);

  eventSource.addEventListener("Replies", (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data);
      const text: string = data.text ?? "";
      if (!text) return;

      store.addMessage({ role: "assistant", content: text });
      store.setStreaming(false);

      // Bridge plain text to A2UI surface
      const fallbackMessages = fallbackParse({
        type: "MarkdownView",
        data: text,
      });
      if (fallbackMessages) {
        fallbackMessages.forEach((msg) => {
          if ("createSurface" in msg) {
            surfaceStore.createSurface(
              msg.createSurface.surfaceId,
              msg.createSurface.catalogId,
              msg.createSurface.theme,
              msg.createSurface.sendDataModel,
            );
          } else if ("updateComponents" in msg) {
            surfaceStore.updateComponents(
              msg.updateComponents.surfaceId,
              msg.updateComponents.components,
            );
          } else if ("updateDataModel" in msg) {
            surfaceStore.updateDataModel(
              msg.updateDataModel.surfaceId,
              msg.updateDataModel.path,
              msg.updateDataModel.value,
            );
          } else if ("deleteSurface" in msg) {
            surfaceStore.deleteSurface(msg.deleteSurface.surfaceId);
          }
        });
      }
    } catch {
      console.warn("Failed to parse SSE Replies event", e.data);
    }
  });

  eventSource.addEventListener("Notif", (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data);
      console.info("[SSE Notif]", data.message);
    } catch {
      // ignore
    }
  });

  eventSource.onerror = () => {
    // Connection lost — clean up
    eventSource.close();
    store.setStreaming(false);
  };
}

/**
 * Load chat history from the backend for a given topic.
 */
export async function loadChatHistory(topicId: string): Promise<void> {
  const store = useChatStore.getState();
  try {
    const res = await fetch(`/api/v1/chat/history?topic_id=${topicId}`);
    if (!res.ok) return;
    const messages: Array<{
      message_id: string;
      role: string;
      message: string;
      created_at: string;
    }> = await res.json();

    messages.forEach((m) => {
      store.addMessage({
        role: m.role as "user" | "assistant",
        content: m.message,
      });
    });
  } catch (err) {
    console.error("Failed to load chat history:", err);
  }
}

/**
 * Send a chat message to the backend and trigger SSE streaming.
 */
export async function sendChatMessage(
  content: string,
  attachments?: File[],
): Promise<void> {
  const store = useChatStore.getState();
  store.addMessage({ role: "user", content });
  store.setStreaming(true);

  try {
    const userId = useAuthStore.getState().userId;
    if (!userId) {
      throw new Error("User ID is not set. Please log in first.");
    }

    let currentTopicId = store.topicId;

    // 1. Create Topic if it doesn't exist
    if (!currentTopicId) {
      const title = content.slice(0, 50) || "New Topic";
      const topicRes = await fetch("/api/v1/topics/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, title }),
      });
      if (!topicRes.ok) throw new Error("Failed to create topic");
      const topicData = await topicRes.json();
      currentTopicId = topicData.topic_id;
      store.setTopicId(currentTopicId);
      // Refresh sidebar topic list
      fetchTopics();
    }

    // 2. Upload Document if there are attachments
    if (attachments && attachments.length > 0 && currentTopicId) {
      const file = attachments[0];
      const uploadData = new FormData();
      uploadData.append("file", file);

      const uploadRes = await fetch(`/api/v1/topics/${currentTopicId}/upload`, {
        method: "POST",
        body: uploadData,
      });
      if (!uploadRes.ok) {
        throw new Error("Failed to upload document");
      }
    }

    // 3. Open SSE stream (connects in background)
    openSseStream(currentTopicId!);

    // 4. Send Chat Message to backend
    const chatRes = await fetch("/api/v1/chat/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic_id: currentTopicId, message: content }),
    });

    if (!chatRes.ok) {
      throw new Error(`Chat request failed: ${chatRes.status}`);
    }

    // The assistant reply will arrive via the SSE "Replies" event.
    // Streaming flag is cleared in the SSE handler.
  } catch (error) {
    console.error("Failed to send chat message:", error);
    store.addMessage({
      role: "system",
      content:
        error instanceof Error
          ? error.message
          : "Failed to connect to server. Please try again.",
    });
    store.setStreaming(false);
  }
}
