import { useState, useRef, useEffect, useCallback } from "react";
import { X, Sparkles, Trash2, ChevronDown, Search, Loader2 } from "lucide-react";
import { useChatStore, sendChatMessage, deleteChatHistory, type StreamingLog } from "../hooks/useChat.ts";
import { MessageBubble } from "./MessageBubble.tsx";
import { ChatInput } from "./ChatInput.tsx";
import { ShiningText } from "../../../components/ui/ShiningText.tsx";

function ThoughtBlock({ log }: { log: StreamingLog }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getIcon = () => {
    switch (log.role) {
      case 'search': return <Search size={14} className="text-slate-400" />;
      case 'tool': return <Sparkles size={14} className="text-slate-400" />;
      default: return <ChevronDown size={14} className={`text-slate-400 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />;
    }
  };

  const getTitle = () => {
    if (log.role === 'thought') return "Thought";
    if (log.role === 'search') return "Searched";
    return "Action";
  };

  return (
    <div className="flex flex-col gap-1.5 px-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-[13px] font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer group"
      >
        <div className="flex items-center justify-center w-5 h-5">
          {getIcon()}
        </div>
        <span>{getTitle()}</span>
        {!isExpanded && <span className="text-slate-400 font-normal truncate max-w-[200px] opacity-0 group-hover:opacity-100 transition-opacity ml-1">{log.message}</span>}
      </button>

      {isExpanded && (
        <div className="ml-7 border-l-2 border-slate-100 pl-4 py-1 animate-in slide-in-from-left-1 duration-200">
          <p className="text-[13px] leading-relaxed text-slate-600 font-medium whitespace-pre-wrap">{log.message}</p>
        </div>
      )}
    </div>
  );
}

export function ChatPanel({ inline = false }: { inline?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingLogs = useChatStore((s) => s.streamingLogs);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom via MutationObserver
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const observer = new MutationObserver(() => {
      // Small timeout ensures layout has updated
      setTimeout(() => {
        if (scrollEl) {
          scrollEl.scrollTop = scrollEl.scrollHeight;
        }
      }, 0);
    });

    observer.observe(scrollEl, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Initial scroll
    scrollEl.scrollTop = scrollEl.scrollHeight;

    return () => observer.disconnect();
  }, [isOpen]); // Re-initialize when panel opens

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
        <Sparkles size={24} />
      </button>
    );
  }

  const containerClass = inline
    ? "flex h-full w-full flex-col bg-[var(--color-surface)]"
    : "fixed right-0 top-0 z-50 flex h-dvh w-full max-w-md flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] sm:right-4 sm:top-4 sm:h-[calc(100dvh-2rem)] sm:rounded-2xl sm:border";

  return (
    <div className={containerClass}>
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-[var(--color-text-muted)]" />
          <h2 className="text-base font-medium text-[var(--color-text-primary)]">Assistant</h2>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => deleteChatHistory()}
            className="cursor-pointer text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
            title="Clear Chat"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="cursor-pointer text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
            title="Collapse"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {
        messages.length === 0 && (
          <div className="px-8 pb-4 pt-10 text-center text-xs text-[var(--color-text-muted)]">
            Responses are generated using AI and may contain mistakes.
          </div>
        )
      }

      <div ref={scrollRef} className="flex flex-1 flex-col gap-8 overflow-y-auto hide-scrollbar p-4">
        {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}

        {isStreaming && (
          <div className="flex flex-col gap-4">
            {streamingLogs.map((log) => (
              <ThoughtBlock
                key={log.id}
                log={log}
              />
            ))}
            <div className="flex justify-start px-2">
              <div className="flex items-center gap-2 text-slate-400">
                <div className="flex items-center justify-center w-5 h-5">
                  <Loader2 size={14} className="animate-spin" />
                </div>
                <ShiningText text="Generating response..." className="text-[13px] font-medium" />
              </div>
            </div>
          </div>
        )}
      </div>

      <ChatInput onSend={handleSend} isStreaming={isStreaming} />
    </div >
  );
}
