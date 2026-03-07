import { create } from "zustand";
import { useAuthStore } from "../../auth/hooks/useAuthStore.ts";
import { useSurfaceStore } from "../../a2ui/store.ts";
import { fallbackParse } from "../../a2ui/fallbackParser.ts";
import { useTopicListStore, fetchTopics } from "../../workspace/hooks/useTopicList.ts";
import { useUIStore } from "../../ui_renderer/store.ts";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  attachments?: Array<{ name: string; type: string; url: string }>;
  audioUrl?: string;
  isAnimatable?: boolean;
}

export interface StreamingLog {
  id: string;
  message: string;
  role: 'thought' | 'tool' | 'search';
}

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingLogs: StreamingLog[];
  topicId: string | null;
  currentAudio: HTMLAudioElement | null;
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void;
  updateMessageAudio: (messageId: string, audioUrl: string) => void;
  setStreaming: (streaming: boolean) => void;
  addStreamingLog: (log: Omit<StreamingLog, "id">) => void;
  setTopicId: (topicId: string | null) => void;
  stopAudio: () => void;
  clear: () => void;
}

// Module-level variables to hold active handles
let activeEventSource: EventSource | null = null;
let activeAudio: HTMLAudioElement | null = null;

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  streamingLogs: [],
  topicId: null,
  currentAudio: null,

  stopAudio: () => {
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio = null;
      set({ currentAudio: null });
    }
  },

  addMessage: (msg) => {
    // If user sends a new message, stop any playing audio immediately
    if (msg.role === 'user') {
      get().stopAudio();
    }

    set((state) => ({
      messages: [
        ...state.messages,
        { ...msg, id: crypto.randomUUID(), timestamp: Date.now() },
      ],
    }));
  },

  updateMessageAudio: (messageId, audioUrl) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, audioUrl } : m,
      ),
    })),

  setStreaming: (isStreaming) => set((state) => ({
    isStreaming,
    streamingLogs: isStreaming ? state.streamingLogs : []
  })),
  addStreamingLog: (log) => set((state) => ({
    streamingLogs: [...state.streamingLogs, { ...log, id: crypto.randomUUID() }]
  })),
  setTopicId: (topicId) => set({ topicId }),
  clear: () => {
    get().stopAudio();
    set({ messages: [], isStreaming: false, streamingLogs: [], topicId: null });
  },
}));

/**
 * Open an SSE connection for a given session (topic) and handle incoming events.
 * Returns a Promise that resolves when the connection is fully established.
 */
function openSseStream(sessionId: string): Promise<void> {
  return new Promise((resolve) => {
    // If we're already connected to this topic, just return
    if (activeEventSource && activeEventSource.url.includes(`/api/v1/chat/stream/${sessionId}`)) {
      return resolve();
    }

    // Close any previous connections gracefully
    if (activeEventSource) {
      activeEventSource.close();
    }

    const store = useChatStore.getState();
    const surfaceStore = useSurfaceStore.getState();

    const url = `/api/v1/chat/stream/${sessionId}`;
    const eventSource = new EventSource(url);
    activeEventSource = eventSource;

    eventSource.onopen = () => {
      resolve();
    };

    eventSource.onerror = (error) => {
      console.error("[SSE Error] Stream disconnected or failed", error);
      // EventSource tries to reconnect automatically by default, but if it dies or the 
      // backend closes it unexpectedly during a long generation, we can force a manual retry
      // after a short delay to keep the UI connected.
      eventSource.close();
      activeEventSource = null;

      setTimeout(() => {
        console.info("[SSE Retry] Attempting to reconnect to", url);
        openSseStream(sessionId).catch(console.error);
      }, 3000);
    };

    eventSource.addEventListener("Replies", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const text: string = data.text ?? "";
        if (!text) return;

        store.addMessage({ role: "assistant", content: text, isAnimatable: true });
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

    // ── TTS audio: auto-play when the backend finishes generating speech ──
    eventSource.addEventListener("TTSResult", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const rawUrl: string = data.audio_url ?? "";
        if (!rawUrl) return;

        // Backend returns /media/tts/... but serves files at /uploads/tts/...
        const audioUrl = rawUrl.replace(/^\/media\//, "/uploads/");

        // Auto-play (allowed because user initiated the interaction)
        activeAudio = new Audio(audioUrl);
        activeAudio.playbackRate = 1.1;

        activeAudio.play().catch((err) => console.warn("TTS autoplay blocked:", err));

        activeAudio.onended = () => {
          activeAudio = null;
        };
      } catch {
        console.warn("Failed to parse SSE TTSResult event", e.data);
      }
    });

    // ── V3 & MarkGraph UI Updates ──
    eventSource.addEventListener("UIUpdate", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        console.log("[USE-CHAT] Received SSE UIUpdate Event:", data);
        const { topic_id, scene_id, ui_json, ui_markdown } = data;
        
        // Push to legacy A2UI store
        useUIStore.getState().setUI(topic_id, scene_id, ui_json);
        
        // Push to new MarkGraph store
        import("../../markgraph/store.ts").then(mod => {
            mod.useMarkGraphStore.getState().setUI(topic_id, scene_id, ui_json, ui_markdown);
        }).catch(err => console.warn("Could not import MarkGraph store", err));
      } catch (err) {
        console.warn("Failed to parse SSE UIUpdate event", e.data);
      }
    });

    // ── Tool Calls (Web Search & UI Generation) ──
    eventSource.addEventListener("ToolCall", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.tool_name === "web_search") {
          store.addStreamingLog({
            role: 'search',
            message: `Searching for: ${data.arguments?.query || data.arguments?.description || 'information'}`
          });
        } else if (data.tool_name === "edit_ui") {
          store.addStreamingLog({
            role: 'tool',
            message: `Designing UI: ${data.arguments?.description || 'your request'}`
          });
        } else if (data.tool_name === "list_topic_facts" || data.tool_name === "retrieve_facts") {
          store.addStreamingLog({
            role: 'thought',
            message: `Analyzing topic knowledge base...`
          });
        } else {
          store.addStreamingLog({
            role: 'tool',
            message: `Using tool: ${data.tool_name}`
          });
        }
      } catch (err) {
        console.warn("Failed to parse SSE ToolCall event", e.data);
      }
    });

    eventSource.addEventListener("Notif", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        console.info("[SSE Notif]", data.message);
        const msgStr = data.message || "";
        if (msgStr.startsWith("Error:")) {
          store.addMessage({ role: "system", content: msgStr });
          store.setStreaming(false);
        } else if (msgStr) {
          store.addStreamingLog({
            role: 'thought',
            message: msgStr
          });
        }
      } catch {
        // ignore
      }
    });
    eventSource.onerror = () => {
      // Connection lost — clean up
      eventSource.close();
      store.setStreaming(false);
    };
  });
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
 * Delete chat history for the current topic from the backend and clear the UI.
 */
export async function deleteChatHistory(): Promise<void> {
  const store = useChatStore.getState();
  const currentTopicId = store.topicId;

  if (currentTopicId) {
    try {
      const res = await fetch(`/api/v1/chat/history?topic_id=${currentTopicId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        // Find next topic to select
        const topicStore = useTopicListStore.getState();
        const topics = topicStore.topics;
        const currentIndex = topics.findIndex(t => t.topic_id === currentTopicId);

        let nextTopicId: string | null = null;
        if (topics.length > 1 && currentIndex !== -1) {
          // If the first topic is deleted, select the new first topic. Otherwise select the previous one.
          const nextIndex = currentIndex === 0 ? 1 : currentIndex - 1;
          nextTopicId = topics[nextIndex].topic_id;
        }

        // Locally remove the topic so it disappears from the sidebar without using the backend
        const newTopics = topics.filter(t => t.topic_id !== currentTopicId);
        topicStore.setTopics(newTopics);

        // Clear existing states and connections
        store.clear();
        useSurfaceStore.getState().clearAll();
        if (activeEventSource) {
          activeEventSource.close();
          activeEventSource = null;
        }

        // Switch to next topic if available
        if (nextTopicId) {
          store.setTopicId(nextTopicId);
          loadChatHistory(nextTopicId);
        }

        return;
      } else {
        console.error("Failed to delete chat history:", res.status);
      }
    } catch (err) {
      console.error("Error deleting chat history:", err);
    }
  }

  // Clear local stores unconditionally so user always gets a clean slate 
  store.clear();
  useSurfaceStore.getState().clearAll();
  useUIStore.getState().clear();
  import("../../markgraph/store.ts")
    .then(mod => mod.useMarkGraphStore.getState().clear())
    .catch(() => {});
  
  if (activeEventSource) {
    activeEventSource.close();
    activeEventSource = null;
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
  store.addMessage({
    role: "user",
    content,
    attachments: attachments?.map(file => ({
      name: file.name,
      type: file.name.split('.').pop()?.toUpperCase() || "FILE",
      url: ""
    }))
  });
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
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId,
        },
        body: JSON.stringify({ title }),
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

    // 3. Open SSE stream and wait until it's officially connected
    await openSseStream(currentTopicId!);

    // 4. Send Chat Message to backend (only after SSE is open)
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
