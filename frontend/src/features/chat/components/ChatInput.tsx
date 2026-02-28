import { useState, useRef, useCallback } from "react";
import { X, Paperclip, FileText } from "lucide-react";

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
    <div className="bg-[var(--color-surface)] p-4">
      {files.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-3 px-2">
          {files.map((file, i) => (
            <div
              key={i}
              className="relative flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 pr-4 shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500 text-white">
                <FileText size={20} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col">
                <span className="max-w-[150px] truncate text-sm font-semibold text-[var(--color-text-primary)]">
                  {file.name}
                </span>
                <span className="text-xs font-medium text-[var(--color-text-muted)]">
                  {file.name.split('.').pop()?.toUpperCase() || "FILE"}
                </span>
              </div>
              <button
                onClick={() => removeFile(i)}
                className="absolute -right-2 -top-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm transition-transform hover:scale-110"
              >
                <X size={14} strokeWidth={3} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative flex items-center rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 shadow-sm transition-shadow focus-within:ring-1 focus-within:ring-[var(--color-border)]">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.mp3,.wav"
          onChange={handleFileSelect}
          className="hidden"
        />

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question..."
          rows={1}
          className="max-h-32 flex-1 resize-none bg-transparent px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none"
        />

        <div className="flex items-center gap-1 px-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text-primary)]"
            title="Attach file"
          >
            <Paperclip size={18} />
          </button>
          <button
            onClick={handleSubmit}
            disabled={isStreaming || (!text.trim() && files.length === 0)}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[var(--color-primary)] text-[var(--color-surface)] transition-opacity hover:opacity-90 disabled:opacity-40"
            title="Send"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
