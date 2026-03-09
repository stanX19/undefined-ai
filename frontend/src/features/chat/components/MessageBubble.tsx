import { useState, useEffect } from "react";
import { useChatStore, type ChatMessage } from "../hooks/useChat.ts";
import { ThumbsUp, ThumbsDown, Copy, FileText, Check, Volume2, VolumeX } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface Props {
  message: ChatMessage;
}

function TtsMuteButton() {
  const ttsMuted = useChatStore((s) => s.ttsMuted);
  const toggleTtsMute = useChatStore((s) => s.toggleTtsMute);

  return (
    <button
      onClick={toggleTtsMute}
      className="cursor-pointer hover:text-text-primary transition-colors"
      title={ttsMuted ? "Unmute TTS" : "Mute TTS"}
    >
      {ttsMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
    </button>
  );
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isAssistant = !isUser && !isSystem;

  const [displayedText, setDisplayedText] = useState(() => {
    if (isAssistant && message.isAnimatable) return "";
    return message.content || "";
  });

  const [isTyping, setIsTyping] = useState(() => {
    return isAssistant && message.isAnimatable;
  });

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isTyping || !message.content) return;

    let i = 0;
    const intervalId = setInterval(() => {
      i += 1;
      if (i >= message.content.length) {
        setDisplayedText(message.content);
        clearInterval(intervalId);
        setIsTyping(false);
      } else {
        setDisplayedText(message.content.slice(0, i));
      }
    }, 15);

    return () => clearInterval(intervalId);
  }, [isTyping, message.content]);

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
      {message.attachments && message.attachments.length > 0 && (
        <div className="flex flex-col gap-2">
          {message.attachments.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface p-1.5 pr-4 shadow-sm"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-[0.6rem] bg-[#d1fb9f] text-gray-600">
                <FileText size={16} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col text-left">
                <span className="max-w-[140px] truncate text-xs font-semibold text-text-primary">
                  {file.name}
                </span>
                <span className="text-[10px] font-medium leading-none text-text-muted mt-1">
                  {file.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {message.content && (
        <div
          className={`text-[15px] leading-relaxed ${isUser
            ? "max-w-[85%] bg-(--ds-ghost-hover,#F3F4F6) text-text-primary rounded-2xl px-5 py-2.5 whitespace-pre-wrap"
            : isSystem
              ? "max-w-[90%] border border-amber-300 bg-amber-50 text-amber-800 px-4 py-2.5 rounded-2xl whitespace-pre-wrap"
              : "w-full bg-transparent text-text-body pr-2 overflow-x-hidden"
            }`}
        >
          {isAssistant ? <MarkdownRenderer content={displayedText} /> : message.content}
        </div>
      )}

      {isAssistant && !isTyping && (
        <div className="flex items-center gap-3 text-text-muted mt-4">
          <button className="cursor-pointer hover:text-text-primary transition-colors" title="Helpful">
            <ThumbsUp size={16} />
          </button>
          <button className="cursor-pointer hover:text-text-primary transition-colors" title="Not helpful">
            <ThumbsDown size={16} />
          </button>
          <button onClick={handleCopy} className="cursor-pointer hover:text-text-primary transition-colors" title="Copy text">
            {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
          </button>
          <TtsMuteButton />
        </div>
      )}
    </div>
  );
}
