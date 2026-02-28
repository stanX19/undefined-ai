import { create } from "zustand";
import { useAuthStore } from "../../auth/hooks/useAuthStore.ts";
import { useSurfaceStore } from "../../a2ui/store.ts";
import { fallbackParse } from "../../a2ui/fallbackParser.ts";

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
    }

    // 2. Upload Document if there are attachments
    if (attachments && attachments.length > 0 && currentTopicId) {
      const file = attachments[0]; // Assuming one file for now
      const uploadData = new FormData();
      uploadData.append("file", file);

      const uploadRes = await fetch(`/api/v1/topics/${currentTopicId}/upload`, {
        method: "POST",
        body: uploadData,
      });
      if (!uploadRes.ok) {
        console.warn("Failed to upload document");
        throw new Error("Failed to upload document");
      }
    }

    // 3. Send Chat Message
    // Commented out to not wire the chat message first
    /*
    const chatRes = await fetch("/api/v1/chat/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic_id: currentTopicId, message: content }),
    });

    if (!chatRes.ok) {
      throw new Error(`Chat request failed: ${chatRes.status}`);
    }

    const data = await chatRes.json();
    const replyText = data.assistant_message?.message;
    */

    // Mocked response for now
    await new Promise(resolve => setTimeout(resolve, 1000));
    const replyText = "I received your message! (Chat API is temporarily disabled).";

    if (replyText) {
      store.addMessage({ role: "assistant", content: replyText });
      
      // Bridge plain text response to A2UI surface for Phase 1
      const surfaceStore = useSurfaceStore.getState();
      const fallbackMessages = fallbackParse({
        type: "MarkdownView",
        data: replyText,
      });
      
      if (fallbackMessages) {
        fallbackMessages.forEach(msg => {
          if ('createSurface' in msg) {
            surfaceStore.createSurface(
              msg.createSurface.surfaceId, 
              msg.createSurface.catalogId, 
              msg.createSurface.theme, 
              msg.createSurface.sendDataModel
            );
          } else if ('updateComponents' in msg) {
            surfaceStore.updateComponents(
              msg.updateComponents.surfaceId, 
              msg.updateComponents.components
            );
          } else if ('updateDataModel' in msg) {
            surfaceStore.updateDataModel(
              msg.updateDataModel.surfaceId, 
              msg.updateDataModel.path, 
              msg.updateDataModel.value
            );
          } else if ('deleteSurface' in msg) {
            surfaceStore.deleteSurface(msg.deleteSurface.surfaceId);
          }
        });
      }
    }
  } catch (error) {
    console.error("Failed to send chat message:", error);
    store.addMessage({
      role: "system",
      content: error instanceof Error ? error.message : "Failed to connect to server. Please try again.",
    });
  } finally {
    store.setStreaming(false);
  }
}
