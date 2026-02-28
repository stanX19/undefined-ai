import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, X, Minimize2, Plus } from "lucide-react";
import { useChatStore, sendChatMessage } from "../hooks/useChat.ts";
import { MessageBubble } from "./MessageBubble.tsx";
import { ChatInput } from "./ChatInput.tsx";

export function ChatPanel({ inline = false }: { inline?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const clearChat = useChatStore((s) => s.clear);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback((message: string, files?: File[]) => {
    sendChatMessage(message, files);
  }, []);

  if (!inline && !isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-6 bottom-6 z-50 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-(--a2ui-primary,var(--color-primary)) text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
        title="Open chat"
      >
        <MessageSquare size={24} />
      </button>
    );
  }

  const containerClass = inline 
    ? "flex h-full w-full flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)]" 
    : "fixed right-0 top-0 z-50 flex h-dvh w-full max-w-md flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl sm:right-4 sm:top-4 sm:h-[calc(100dvh-2rem)] sm:rounded-2xl sm:border";

  return (
    <div className={containerClass}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-(--a2ui-primary,var(--color-primary))" />
          <h2 className="text-sm font-semibold">undefined ai</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearChat}
            className="cursor-pointer rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-alt"
            title="New Topic"
          >
            <Plus size={16} />
          </button>
          {!inline && (
            <>
              <button
                onClick={() => setIsOpen(false)}
                className="cursor-pointer rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-alt"
                title="Minimize"
              >
                <Minimize2 size={16} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="cursor-pointer rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-alt"
                title="Close"
              >
                <X size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <div className="rounded-full bg-[var(--color-surface-alt)] p-4">
              <MessageSquare size={28} className="text-[var(--color-text-muted)]" />
            </div>
            <div>
              <p className="font-medium">Start learning</p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Upload a PDF, paste a URL, or just ask a question.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}

        {isStreaming && (
          <div className="flex justify-start">
            <div className="flex gap-1 rounded-2xl bg-[var(--color-surface-alt)] px-4 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-text-muted)] [animation-delay:0ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-text-muted)] [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-text-muted)] [animation-delay:300ms]" />
            </div>
          </div>
        )}
      </div>

      <ChatInput onSend={handleSend} isStreaming={isStreaming} />
    </div>
  );
}
