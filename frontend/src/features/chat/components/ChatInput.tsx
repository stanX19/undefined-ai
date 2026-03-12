import { useState, useRef, useCallback, useEffect } from "react";
import { X, Paperclip, FileText, Mic, Loader2, Square, Globe } from "lucide-react";


interface Props {
  onSend: (message: string, files?: File[]) => void;
  isStreaming: boolean;
  /** When true, outer wrapper is transparent (e.g. on home page with gradient background) */
  embedded?: boolean;
}

export function ChatInput({ onSend, isStreaming, embedded }: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        await handleSTT(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleSTT = async (blob: Blob) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("file", blob, "recording.wav");

      const { apiFetch } = await import("../../../constants/api");
      const response = await apiFetch("/api/v1/speech/stt", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("STT Request failed");

      const data = await response.json();
      if (data.text) {
        onSend(data.text);
      }
    } catch (err) {
      console.error("STT Error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

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
    <div className={embedded ? "bg-transparent p-4" : "bg-surface p-4"}>
      {files.length > 0 && (
        <div className={`mb-3 flex gap-2 ${embedded ? "flex-row flex-wrap" : "flex-col"}`}>
          {files.map((file, i) => (
            <div
              key={i}
              className="relative flex items-center gap-2.5 rounded-2xl border border-border bg-surface p-1.5 pr-3 shadow-sm self-start"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-400">
                <FileText size={16} strokeWidth={2.5} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="max-w-[140px] truncate text-xs font-semibold text-text-primary">
                  {file.name}
                </span>
                <span className="text-[10px] font-medium leading-none text-text-muted">
                  {file.name.split('.').pop()?.toUpperCase() || "FILE"}
                </span>
              </div>
              <button
                onClick={() => removeFile(i)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-border bg-surface text-text-primary shadow-sm transition-transform hover:scale-110"
              >
                <X size={12} strokeWidth={3} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative flex flex-col rounded-3xl border border-border bg-surface shadow-sm transition-shadow focus-within:ring-1 focus-within:ring-border">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.mp3,.wav"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex w-full pt-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            rows={embedded ? 4 : 1}
            className={`flex-1 resize-none bg-transparent px-6 text-sm text-text-primary placeholder-text-muted focus:outline-none hide-scrollbar max-h-48 ${embedded ? "min-h-[96px] py-4" : "min-h-[40px] py-2"
              }`}
          />
        </div>

        <div className="flex items-center justify-between px-3 pb-3 mt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-(--color-surface-alt) text-text-muted transition-colors hover:bg-gray-200 hover:text-text-primary"
              title="Attach file"
            >
              <Paperclip size={18} />
            </button>

            <button
              onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
              className={`flex h-8 cursor-pointer items-center overflow-hidden rounded-full transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] border ${isWebSearchEnabled
                  ? "bg-[#e1f5fd] text-[#0288d1] border-[#81d4fa] w-[90px]"
                  : "bg-(--color-surface-alt) text-text-muted hover:bg-gray-200 hover:text-text-primary border-transparent w-8"
                }`}
              title="Toggle Web Search"
            >
              <div className="flex h-full w-[30px] shrink-0 items-center justify-center">
                <Globe size={18} className={`transition-transform duration-300 ${isWebSearchEnabled ? "rotate-360" : "rotate-0"}`} />
              </div>
              <span
                className={`text-sm font-medium transition-all duration-300 whitespace-nowrap ${isWebSearchEnabled ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
                  }`}
              >
                Search
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 pr-1.5 ml-1">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isStreaming || isProcessing}
              className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-all duration-300 ${isRecording
                ? "bg-red-500 text-white animate-pulse"
                : "bg-transparent text-text-muted hover:bg-(--color-surface-alt) hover:text-text-primary"
                }`}
              title={isRecording ? "Stop recording" : "Voice mode"}
            >
              {isProcessing ? (
                <Loader2 size={18} className="animate-spin" />
              ) : isRecording ? (
                <Square size={14} fill="currentColor" />
              ) : (
                <Mic size={18} />
              )}
            </button>

            <div className="flex h-8 w-8 items-center justify-center">
              <button
                onClick={handleSubmit}
                disabled={isStreaming || (!text.trim() && files.length === 0)}
                className={`flex items-center justify-center bg-primary text-surface transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-center ${isStreaming
                    ? "h-4 w-4 rounded-[5px] animate-[spin_3s_linear_infinite]"
                    : "h-8 w-8 rounded-full " +
                    ((!text.trim() && files.length === 0)
                      ? "opacity-40 cursor-not-allowed"
                      : "cursor-pointer hover:opacity-90 hover:scale-105 active:scale-95")
                  }`}
                title="Send"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-all duration-300 ${isStreaming ? "scale-0 opacity-0 w-0 h-0" : "scale-100 opacity-100 w-4 h-4"}`}
                >
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
