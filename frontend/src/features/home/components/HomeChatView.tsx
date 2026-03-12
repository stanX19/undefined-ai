import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, BookOpen, Lightbulb, ArrowRight } from "lucide-react";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { useChatStore, sendChatMessage } from "../../chat/hooks/useChat";
import { ChatInput } from "../../chat/components/ChatInput";
import { GradientText } from "../../../components/ui/GradientText";
import { useRecommendations, type Recommendation } from "../hooks/useRecommendations";
import { AiMotionLogo } from "./AiMotionLogo";
import { BgGradient } from "./BgGradient";

function formatUserName(username: string | null, email: string | null): string {
  if (username) return username;
  if (!email) return "there";
  const name = email.includes("@") ? email.split("@")[0] : email;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Distinct colors per card, matching MenuPage recommendation cards */
const CARD_STYLES = [
  { bg: "bg-[#ffedd4]", iconBg: "bg-[#fdba74]", iconColor: "text-[#9a3412]", accent: "text-[#c2410c]" },
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
      className={`group flex min-h-[140px] sm:min-h-[165px] flex-col gap-2.5 rounded-3xl border border-[rgba(55,50,47,0.08)] ${style.bg} p-4 text-left backdrop-blur-sm transition-all duration-200 hover:border-[rgba(55,50,47,0.12)] hover:shadow-md cursor-pointer short-height:min-h-[120px] short-height:sm:min-h-[140px] short-height:gap-2 short-height:p-3 very-short-height:min-h-[100px] very-short-height:sm:min-h-[120px] very-short-height:gap-1.5 very-short-height:p-2.5`}
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${style.iconBg}`}>
        <Icon size={18} className={style.iconColor} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-[#37322F] line-clamp-2 font-sans">
          {rec.title}
        </span>
        <span className="text-xs text-[#605A57] line-clamp-3 font-sans">{rec.reason}</span>
      </div>
      <div className={`mt-auto flex items-center gap-1 text-xs font-medium ${style.accent} opacity-0 transition-opacity group-hover:opacity-100 font-sans`}>
        Explore <ArrowRight size={12} />
      </div>
    </button>
  );
}

export function HomeChatView() {
  const navigate = useNavigate();
  const username = useAuthStore((s) => s.username);
  const email = useAuthStore((s) => s.email);
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

  const userName = formatUserName(username, email);

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col items-center overflow-y-auto overflow-x-hidden hide-scrollbar bg-[#F7F5F3]">
      <BgGradient gradientFrom="#F7F5F3" gradientTo="#e8f0e8" />

      <div className="flex min-w-0 w-full max-w-4xl flex-1 flex-col items-center justify-start gap-4 px-4 pt-8 pb-[max(2rem,calc(2rem+env(safe-area-inset-bottom)))] sm:px-6 sm:pt-12 sm:pb-[max(3rem,calc(3rem+env(safe-area-inset-bottom)))] md:pt-16 md:pb-[max(4rem,calc(4rem+env(safe-area-inset-bottom)))] short-height:gap-3 short-height:pt-6 short-height:pb-[max(1.5rem,calc(1.5rem+env(safe-area-inset-bottom)))] very-short-height:gap-2 very-short-height:pt-4 very-short-height:pb-[max(1rem,calc(1rem+env(safe-area-inset-bottom)))]">
        {/* Avatar / AI Motion Logo - no container */}
        <div className="relative mt-2 shrink-0 short-height:mt-0">
          <AiMotionLogo className="h-32 w-32 sm:h-40 sm:w-40 md:h-52 md:w-52 short-height:h-24 short-height:w-24 short-height:sm:h-28 short-height:sm:w-28 short-height:md:h-36 short-height:md:w-36 very-short-height:h-20 very-short-height:w-20" />
          <div className="absolute -inset-4 -z-10 rounded-full bg-orange-200/30 blur-2xl" />
        </div>

        {/* Greeting */}
        <div className="text-center mb-4 short-height:mb-2 very-short-height:mb-1">
          <h1 className="text-3xl font-semibold tracking-tight text-[#49423D] sm:text-4xl font-sans short-height:text-2xl short-height:sm:text-3xl very-short-height:text-xl very-short-height:sm:text-2xl">
            Welcome, {userName}
          </h1>
          <p className="mt-1.5 text-lg text-[#605A57] sm:text-xl font-sans short-height:text-base short-height:sm:text-lg very-short-height:text-sm very-short-height:sm:text-base">
            What do you want to{" "}
            <GradientText className="font-semibold text-lg sm:text-xl" colors={["#ea580c", "#f59e0b", "#fbbf24"]}>
              explore
            </GradientText>
            {" "}today?
          </p>
        </div>

        {/* Recommendation Cards */}
        {isLoadingRecs ? (
          <div className="flex items-center gap-3 py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E0DEDB] border-t-[#37322F]" />
            <span className="text-sm text-[#605A57] font-sans">
              Finding topics for you...
            </span>
          </div>
        ) : recommendations.length > 0 ? (
          <div className="grid w-full max-w-[calc(100%-2rem)] mx-auto grid-cols-1 gap-2.5 sm:grid-cols-3 short-height:gap-2 very-short-height:gap-1.5">
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
        <div className="w-full shrink-0">
          <ChatInput onSend={handleSend} isStreaming={isStreaming} embedded />
          <p className="mt-2 text-center text-[11px] text-[#605A57] font-sans short-height:mt-1.5 very-short-height:mt-1">
            Responses are generated using AI and may contain mistakes.
          </p>
        </div>
      </div>
    </div>
  );
}
