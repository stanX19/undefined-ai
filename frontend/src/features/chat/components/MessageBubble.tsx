import type { ChatMessage } from "../hooks/useChat.ts";
import { ThumbsUp, ThumbsDown, Copy, FileText } from "lucide-react";

interface Props {
  message: ChatMessage;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <div className={`flex flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
      {message.attachments && message.attachments.length > 0 && (
        <div className="flex flex-col gap-2">
          {message.attachments.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 pr-6 shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500 text-white">
                <FileText size={20} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col text-left">
                <span className="max-w-[150px] truncate text-sm font-semibold text-[var(--color-text-primary)]">
                  {file.name}
                </span>
                <span className="text-xs font-medium text-[var(--color-text-muted)]">
                  {file.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {message.content && (
        <div
          className={`max-w-[90%] text-[15px] leading-relaxed ${isUser
            ? "bg-[var(--ds-ghost-hover,#F3F4F6)] text-[var(--color-text-primary)] rounded-[24px] px-5 py-2.5"
            : isSystem
              ? "border border-amber-300 bg-amber-50 text-amber-800 px-4 py-2.5 rounded-2xl"
              : "bg-transparent text-[var(--color-text-body)]"
            }`}
        >
          {message.content}
        </div>
      )}

      {!isUser && !isSystem && (
        <div className="flex items-center gap-3 text-[var(--color-text-muted)] mt-4">
          <button className="cursor-pointer hover:text-[var(--color-text-primary)] transition-colors">
            <ThumbsUp size={16} />
          </button>
          <button className="cursor-pointer hover:text-[var(--color-text-primary)] transition-colors">
            <ThumbsDown size={16} />
          </button>
          <button className="cursor-pointer hover:text-[var(--color-text-primary)] transition-colors">
            <Copy size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
