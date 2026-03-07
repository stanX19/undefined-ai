import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  BookOpen,
  Lightbulb,
  ArrowRight,
  Paperclip,
  Globe,
} from "lucide-react";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { useChatStore, sendChatMessage } from "../../chat/hooks/useChat";
import { useRecommendations, type Recommendation } from "../hooks/useRecommendations";
import { BgGradient } from "./BgGradient";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  if (hour >= 17 && hour < 21) return "Good Evening";
  return "Good Night";
}

function formatUserName(userId: string | null): string {
  if (!userId) return "there";
  const name = userId.includes("@") ? userId.split("@")[0] : userId;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const CARD_STYLES = [
  { bg: "bg-[#d5fba8]/30", border: "border-[#d5fba8]/60", iconBg: "bg-[#d5fba8]/70" },
  { bg: "bg-[#e8f4d8]/40", border: "border-[#c8deb0]/60", iconBg: "bg-[#c8deb0]/70" },
  { bg: "bg-[#f0f7e4]/40", border: "border-[#dcedc8]/60", iconBg: "bg-[#dcedc8]/70" },
];

const CARD_ICONS = [BookOpen, Lightbulb, Sparkles];

function RecommendationCard({
  rec,
  index,
  onSelect,
}: {
  rec: Recommendation;
  index: number;
  onSelect: (rec: Recommendation) => void;
}) {
  const style = CARD_STYLES[index % CARD_STYLES.length];
  const Icon = CARD_ICONS[index % CARD_ICONS.length];

  return (
    <button
      onClick={() => onSelect(rec)}
      className={`group flex flex-col gap-3 rounded-2xl border ${style.border} ${style.bg} p-5 text-left backdrop-blur-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-lg cursor-pointer`}
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${style.iconBg}`}>
        <Icon size={18} className="text-[#3d6b00]" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-[#212529] line-clamp-2">
          {rec.title}
        </span>
        <span className="text-xs text-gray-500 line-clamp-2">{rec.reason}</span>
      </div>
      <div className="mt-auto flex items-center gap-1 text-xs font-medium text-[#5a8a00] opacity-0 transition-opacity group-hover:opacity-100">
        Explore <ArrowRight size={12} />
      </div>
    </button>
  );
}

export function HomeChatView() {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.userId);
  const clearChat = useChatStore((s) => s.clear);

  const { recommendations, isLoading: isLoadingRecs, needsOnboarding } = useRecommendations();
  const [text, setText] = useState("");

  if (needsOnboarding) {
    navigate("/onboarding", { replace: true });
    return null;
  }

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    clearChat();
    sendChatMessage(trimmed);
    setText("");
    navigate("/workspace");
  }, [text, clearChat, navigate]);

  const handleSelectRecommendation = useCallback(
    (rec: Recommendation) => {
      clearChat();
      sendChatMessage(`Search the web and tell me about: ${rec.title}`);
      navigate("/workspace");
    },
    [clearChat, navigate]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const greeting = getGreeting();
  const userName = formatUserName(userId);

  return (
    <div className="relative flex flex-1 flex-col items-center overflow-y-auto hide-scrollbar">
      <BgGradient />

      <div className="flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
        {/* Avatar / Logo */}
        <div className="relative">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/80 shadow-lg shadow-[#d5fba8]/30 backdrop-blur-sm ring-1 ring-[#d5fba8]/40">
            <img
              src="/logo.png"
              alt="Logo"
              className="h-9 w-auto object-contain"
            />
          </div>
          <div className="absolute -inset-4 -z-10 rounded-full bg-[#d5fba8]/20 blur-2xl" />
        </div>

        {/* Greeting */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[#212529] sm:text-4xl">
            {greeting}, {userName}
          </h1>
          <p className="mt-2 text-lg text-gray-500 sm:text-xl">
            How Can I{" "}
            <span className="font-semibold text-[#4a7a00]">Assist</span> You
            Today?
          </p>
        </div>

        {/* Recommendation Cards */}
        {isLoadingRecs ? (
          <div className="flex items-center gap-3 py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-[2.5px] border-[#d5fba8] border-t-transparent" />
            <span className="text-sm text-gray-400">
              Finding topics for you...
            </span>
          </div>
        ) : recommendations.length > 0 ? (
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
            {recommendations.slice(0, 3).map((rec, idx) => (
              <RecommendationCard
                key={idx}
                rec={rec}
                index={idx}
                onSelect={handleSelectRecommendation}
              />
            ))}
          </div>
        ) : null}

        {/* Chat Input */}
        <div className="w-full">
          <div className="relative flex flex-col rounded-3xl border border-gray-200/80 bg-white/70 shadow-lg shadow-black/3 backdrop-blur-md transition-shadow focus-within:shadow-xl focus-within:ring-1 focus-within:ring-[#d5fba8]/60">
            <div className="flex w-full pt-3">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Initiate a query or send a command to the AI..."
                rows={1}
                className="max-h-32 flex-1 resize-none bg-transparent px-5 py-2 text-sm text-[#212529] placeholder-gray-400 focus:outline-none hide-scrollbar"
              />
            </div>

            <div className="flex items-center justify-between px-3 pb-3 mt-1">
              <div className="flex items-center gap-1.5">
                <button className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-[#212529] cursor-pointer">
                  <Paperclip size={16} />
                </button>
                <button className="flex h-8 items-center gap-1.5 rounded-full border border-gray-200 px-3 text-xs font-medium text-gray-500 transition-colors hover:border-[#d5fba8] hover:bg-[#d5fba8]/10 hover:text-[#3d6b00] cursor-pointer">
                  <Sparkles size={13} />
                  Reasoning
                </button>
                <button className="flex h-8 items-center gap-1.5 rounded-full border border-gray-200 px-3 text-xs font-medium text-gray-500 transition-colors hover:border-[#d5fba8] hover:bg-[#d5fba8]/10 hover:text-[#3d6b00] cursor-pointer">
                  <Globe size={13} />
                  Deep Research
                </button>
              </div>

              <button
                onClick={handleSend}
                disabled={!text.trim()}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300 ${
                  text.trim()
                    ? "bg-[#212529] text-white cursor-pointer hover:bg-[#374151] hover:scale-105 active:scale-95"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            </div>
          </div>

          <p className="mt-3 text-center text-[11px] text-gray-400">
            Responses are generated using AI and may contain mistakes.
          </p>
        </div>
      </div>
    </div>
  );
}
