import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, BookOpen, Lightbulb, ArrowRight } from "lucide-react";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { useChatStore, sendChatMessage } from "../../chat/hooks/useChat";
import { ChatInput } from "../../chat/components/ChatInput";
import { useRecommendations, type Recommendation } from "../hooks/useRecommendations";
import { AiMotionLogo } from "./AiMotionLogo";
import { BgGradient } from "./BgGradient";

function formatUserName(userId: string | null): string {
  if (!userId) return "there";
  const name = userId.includes("@") ? userId.split("@")[0] : userId;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Distinct colors per card, matching MenuPage recommendation cards */
const CARD_STYLES = [
  { bg: "bg-[#d5fba8]", iconBg: "bg-[#a8e070]", iconColor: "text-[#3d6b00]", accent: "text-[#5a8a00]" },
  { bg: "bg-[#f7f4f4]", iconBg: "bg-[#d0cdcd]", iconColor: "text-gray-600", accent: "text-gray-600" },
  { bg: "bg-[#e0f4f1]", iconBg: "bg-[#a0e0d8]", iconColor: "text-[#0d9488]", accent: "text-[#0d9488]" },
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
      className={`group flex min-h-[165px] flex-col gap-2.5 rounded-2xl border-0 ${style.bg} p-4 text-left backdrop-blur-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-lg cursor-pointer`}
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${style.iconBg}`}>
        <Icon size={18} className={style.iconColor} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-[#212529] line-clamp-2">
          {rec.title}
        </span>
        <span className="text-xs text-gray-500 line-clamp-3">{rec.reason}</span>
      </div>
      <div className={`mt-auto flex items-center gap-1 text-xs font-medium ${style.accent} opacity-0 transition-opacity group-hover:opacity-100`}>
        Explore <ArrowRight size={12} />
      </div>
    </button>
  );
}

export function HomeChatView() {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.userId);
  const clearChat = useChatStore((s) => s.clear);
  const isStreaming = useChatStore((s) => s.isStreaming);

  const { recommendations, isLoading: isLoadingRecs, needsOnboarding } = useRecommendations();

  if (needsOnboarding) {
    navigate("/onboarding", { replace: true });
    return null;
  }

  const handleSend = useCallback(
    (message: string, files?: File[]) => {
      clearChat();
      sendChatMessage(message, files);
      navigate("/workspace");
    },
    [clearChat, navigate]
  );

  const handleSelectRecommendation = useCallback(
    (rec: Recommendation) => {
      clearChat();
      sendChatMessage(`Search the web and tell me about: ${rec.title}`);
      navigate("/workspace");
    },
    [clearChat, navigate]
  );

  const userName = formatUserName(userId);

  return (
    <div className="relative flex flex-1 flex-col items-center overflow-y-auto hide-scrollbar">
      <BgGradient />

      <div className="flex w-full max-w-4xl flex-1 flex-col items-center justify-start pt-22 gap-4 px-6 pb-6">
        {/* Avatar / AI Motion Logo - no container */}
        <div className="relative mt-2">
          <AiMotionLogo className="h-40 w-40 sm:h-52 sm:w-52" />
          <div className="absolute -inset-4 -z-10 rounded-full bg-[#d5fba8]/20 blur-2xl" />
        </div>

        {/* Greeting */}
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold tracking-tight text-[#212529] sm:text-4xl">
            Welcome, {userName}
          </h1>
          <p className="mt-1.5 text-lg text-gray-500 sm:text-xl">
            What do you want to{" "}
            <span className="font-semibold text-shimmer">explore</span> today?
          </p>
        </div>

        {/* Recommendation Cards */}
        {isLoadingRecs ? (
          <div className="flex items-center gap-3 py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-[2.5px] border-[#d5fba8] border-t-transparent" />
            <span className="text-sm text-gray-400">
              Finding topics for you...
            </span>
          </div>
        ) : recommendations.length > 0 ? (
          <div className="grid w-full max-w-[calc(100%-2rem)] mx-auto grid-cols-1 gap-2.5 sm:grid-cols-3">
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

        {/* Chat Input - same design as ChatPanel */}
        <div className="w-full">
          <ChatInput onSend={handleSend} isStreaming={isStreaming} embedded />
          <p className="mt-2 text-center text-[11px] text-gray-400">
            Responses are generated using AI and may contain mistakes.
          </p>
        </div>
      </div>
    </div>
  );
}
