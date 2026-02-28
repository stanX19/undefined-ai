import { create } from "zustand";

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
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void;
  setStreaming: (streaming: boolean) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,

  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { ...msg, id: crypto.randomUUID(), timestamp: Date.now() },
      ],
    })),

  setStreaming: (isStreaming) => set({ isStreaming }),
  clear: () => set({ messages: [], isStreaming: false }),
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
    const formData = new FormData();
    formData.append("message", content);
    if (attachments) {
      for (const file of attachments) {
        formData.append("files", file);
      }
    }

    const response = await fetch("/api/chat", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Chat request failed: ${response.status}`);
    }

    const data = (await response.json()) as { reply?: string };
    if (data.reply) {
      store.addMessage({ role: "assistant", content: data.reply });
    }
  } catch (error) {
    console.error("Failed to send chat message:", error);
    store.addMessage({
      role: "system",
      content: "Failed to connect to server. Please try again.",
    });
  } finally {
    store.setStreaming(false);
  }
}
