import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useTopicListStore, fetchTopics } from "../workspace/hooks/useTopicList";
import { useAuthStore } from "../auth/hooks/useAuthStore";
import { useChatStore } from "../chat/hooks/useChat";
import { apiFetch } from "../../constants/api";

interface Recommendation {
  title: string;
  difficulty: number;
  reason: string;
}

export function MenuPage() {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.userId);
  const isLoadingTopics = useTopicListStore((s) => s.isLoading);
  const clearChat = useChatStore((s) => s.clear);

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const init = async () => {
      await fetchTopics();
      const currentTopics = useTopicListStore.getState().topics;
      const eduLevel = useAuthStore.getState().educationLevel;

      if (currentTopics.length === 0 && !eduLevel) {
        navigate("/onboarding");
        return;
      }

      setIsLoadingRecs(true);
      try {
        if (currentTopics.length > 0) {
          const res = await apiFetch(`/api/v1/recommendations/latest`);
          if (res.ok) {
            const data = await res.json();
            setRecommendations(data.recommendations || []);
          }
        } else {
          const res = await apiFetch(
            `/api/v1/recommendations/default?education_level=${encodeURIComponent(eduLevel!)}`
          );
          if (res.ok) {
            const data = await res.json();
            setRecommendations(data.recommendations || []);
          }
        }
      } catch (err) {
        console.error("Failed to fetch recommendations:", err);
        hasInitialized.current = false;
      } finally {
        setIsLoadingRecs(false);
      }
    };

    init();
  }, [userId, navigate]);

  const handleNewTopic = () => {
    clearChat();
    navigate("/home");
  };

  const handleSelectRecommendation = (rec: Recommendation) => {
    clearChat();
    navigate("/workspace", { state: { initialTopic: rec.title } });
  };

  const cardBgColors = ["bg-[#d5fba8]", "bg-[#f7f4f4]", "bg-[#e0f4f1]"];

  if (isLoadingTopics) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-[#F7F5F3] font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E0DEDB] border-t-[#37322F]" />
          <span className="text-[#605A57] text-base font-medium font-sans">
            Loading your workspace...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh lg:h-dvh w-full flex-col lg:flex-row bg-[#F7F5F3] font-sans">
      {/* Left Column */}
      <div className="relative flex w-full flex-col justify-center lg:w-1/2 px-6 py-28 sm:px-16 sm:py-32 lg:px-24 lg:py-16">
        <div className="absolute left-6 top-6 z-20 flex max-w-[calc(100vw-3rem)] items-center gap-2.5 sm:left-12 sm:top-8 sm:gap-4 lg:left-12">
          <img src="/logo.png" alt="Logo" className="h-8 w-auto shrink-0 object-contain sm:h-10" />
          <div className="flex min-w-0 items-baseline">
            <span className="truncate text-lg font-semibold tracking-tight text-[#37322F] sm:text-xl">
              Undefined
            </span>
            <span className="ml-1 shrink-0 text-lg font-medium tracking-tight text-[#605A57] sm:ml-2 sm:text-xl">
              AI
            </span>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:mt-12 sm:gap-6 w-full lg:max-w-none">
          <h1 className="text-[#49423D] text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl xl:text-[4rem] font-sans">
            What would you like to{" "}
            <br className="hidden lg:block" />
            explore?
          </h1>
          <p className="text-[#605A57] text-base font-medium leading-relaxed sm:text-xl lg:text-2xl font-sans">
            Choose a recommended topic based on your level, or start a
            <br className="hidden lg:block" />
            completely new exploration.
          </p>
        </div>
      </div>

      {/* Right Column: Cards */}
      <div className="flex w-full flex-1 items-center justify-center p-6 lg:w-1/2 lg:p-10">
        <div className="flex h-full w-full lg:max-h-[850px] flex-col items-center justify-center rounded-lg border border-[rgba(55,50,47,0.12)] bg-[#FAF9F8] p-6 sm:p-10 lg:p-16">
          <div className="grid w-full max-w-[600px] grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
            {isLoadingRecs ? (
              <div className="col-span-1 flex flex-col items-center justify-center gap-4 py-20 text-center sm:col-span-2">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E0DEDB] border-t-[#37322F]" />
                <span className="text-[#605A57] text-base font-medium font-sans">
                  Generating recommendations for you...
                </span>
              </div>
            ) : (
              <>
                {recommendations.slice(0, 3).map((rec, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectRecommendation(rec)}
                    className={`group relative flex h-48 cursor-pointer flex-col justify-between overflow-hidden rounded-lg border border-[rgba(55,50,47,0.08)] p-6 text-left transition-all duration-200 hover:border-[rgba(55,50,47,0.12)] hover:shadow-[0px_0px_0px_0.75px_#E0DEDB_inset] sm:h-56 sm:p-8 ${cardBgColors[idx % cardBgColors.length]}`}
                  >
                    <div className="relative z-10 flex flex-col gap-2">
                      <span className="line-clamp-3 text-xl font-semibold leading-tight text-[#37322F] sm:text-2xl font-sans">
                        {rec.title}
                      </span>
                    </div>
                    <div className="relative z-10 mt-auto flex w-full items-end justify-between">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/80 text-[#37322F] shadow-sm transition-transform duration-200 group-hover:translate-x-1 group-hover:bg-white border border-[rgba(55,50,47,0.08)]">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 12h14" />
                          <path d="m12 5 7 7-7 7" />
                        </svg>
                      </div>
                      <span className="text-4xl font-bold text-[#37322F]/10 sm:text-5xl font-sans">
                        0{idx + 1}
                      </span>
                    </div>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={handleNewTopic}
                  className="group relative flex h-48 cursor-pointer flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-[#E0DEDB] bg-white p-6 transition-all duration-200 hover:border-[rgba(55,50,47,0.12)] hover:bg-[#FAF9F8] sm:h-56 sm:p-8"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#E0DEDB] bg-[#FAF9F8] text-[#605A57] transition-colors duration-200 group-hover:border-[rgba(55,50,47,0.12)] group-hover:bg-[#37322F] group-hover:text-white sm:h-16 sm:w-16">
                    <Plus className="h-6 w-6 sm:h-8 sm:w-8" strokeWidth={2.5} />
                  </div>
                  <span className="text-lg font-semibold text-[#605A57] transition-colors duration-200 group-hover:text-[#37322F] font-sans sm:text-xl">
                    New Topic
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
