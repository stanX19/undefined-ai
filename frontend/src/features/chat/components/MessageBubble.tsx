import type { ChatMessage } from "../hooks/useChat.ts";

interface Props {
  message: ChatMessage;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-[var(--a2ui-primary,var(--color-primary))] text-white"
            : isSystem
              ? "border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
              : "bg-[var(--color-surface-alt)] text-[var(--color-text)]"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
