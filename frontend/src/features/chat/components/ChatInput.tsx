import { useState, useRef, useCallback } from "react";
import { Send, Paperclip, Mic, X } from "lucide-react";

interface Props {
  onSend: (message: string, files?: File[]) => void;
  isStreaming: boolean;
}

export function ChatInput({ onSend, isStreaming }: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && files.length === 0) return;

    onSend(trimmed, files.length > 0 ? files : undefined);
    setText("");
    setFiles([]);
  }, [text, files, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--color-surface-alt)] px-2.5 py-1 text-xs"
            >
              <span className="max-w-32 truncate">{file.name}</span>
              <button
                onClick={() => removeFile(i)}
                className="cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]"
          title="Attach file"
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.mp3,.wav"
          onChange={handleFileSelect}
          className="hidden"
        />

        <button
          className="cursor-pointer rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]"
          title="Voice input"
        >
          <Mic size={18} />
        </button>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything..."
          rows={1}
          className="flex-1 resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 py-2.5 text-sm focus:border-[var(--a2ui-primary,var(--color-primary))] focus:outline-none focus:ring-1 focus:ring-[var(--a2ui-primary,var(--color-primary))]"
        />

        <button
          onClick={handleSubmit}
          disabled={isStreaming || (!text.trim() && files.length === 0)}
          className="cursor-pointer rounded-xl bg-[var(--a2ui-primary,var(--color-primary))] p-2.5 text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          title="Send"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
