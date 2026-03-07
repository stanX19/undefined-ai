import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useTopicListStore, fetchTopics } from "../workspace/hooks/useTopicList";
import { useAuthStore } from "../auth/hooks/useAuthStore";
import { useChatStore } from "../chat/hooks/useChat";

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
            // 1) Wait for topics to fully load
            await fetchTopics();

            // 2) Read fresh state AFTER fetch completes
            const currentTopics = useTopicListStore.getState().topics;
            const eduLevel = useAuthStore.getState().educationLevel;

            if (currentTopics.length === 0 && !eduLevel) {
                navigate("/onboarding");
                return;
            }

            // 3) Fetch recommendations exactly once
            setIsLoadingRecs(true);
            try {
                if (currentTopics.length > 0) {
                    const res = await fetch(`/api/v1/recommendations/latest`, {
                        headers: { "X-User-Id": userId! }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        setRecommendations(data.recommendations || []);
                    }
                } else {
                    const res = await fetch(`/api/v1/recommendations/default?education_level=${encodeURIComponent(eduLevel!)}`);
                    if (res.ok) {
                        const data = await res.json();
                        setRecommendations(data.recommendations || []);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch recommendations:", err);
                hasInitialized.current = false; // allow retry on error
            } finally {
                setIsLoadingRecs(false);
            }
        };

        init();
    }, [userId, navigate]);

    const handleNewTopic = () => {
        clearChat();
        navigate("/workspace");
    };

    const handleSelectRecommendation = (rec: Recommendation) => {
        // Navigate to workspace with the recommended topic text as initial chat intent (or just open new workspace)
        clearChat();
        // A more advanced implementation would pass `rec.title` to the chat store as initial input.
        navigate("/workspace", { state: { initialTopic: rec.title } });
    };

    if (isLoadingTopics) {
        return (
            <div className="flex h-dvh w-full items-center justify-center bg-white font-sans">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#d1fb9f] border-t-transparent"></div>
                  <span className="text-lg font-medium text-gray-500">Loading your workspace...</span>
                </div>
            </div>
        );
    }

    const bgColors = ["bg-[#d5fba8]", "bg-[#f7f4f4]", "bg-[#e0f4f1]"];

    return (
        <div className="flex min-h-dvh lg:h-dvh w-full flex-col lg:flex-row bg-white font-sans text-[#212529]">
            {/* Left Column */}
            <div className="relative flex w-full flex-col justify-center lg:w-1/2 px-6 py-28 sm:px-16 sm:py-32 lg:px-24 lg:py-16">
                {/* Top Left Logo */}
                <div className="absolute left-6 top-6 z-20 flex max-w-[calc(100vw-3rem)] items-center gap-2.5 sm:left-16 sm:top-10 sm:gap-4 lg:left-22">
                    <img src="/logo.png" alt="Logo" className="h-8 w-auto shrink-0 object-contain sm:h-14" />
                    <div className="flex min-w-0 items-baseline">
                        <span className="truncate text-xl font-semibold tracking-tight text-[#212529] sm:text-4xl">undefined</span>
                        <span className="ml-1 shrink-0 text-xl font-medium tracking-tight text-[#868e96] sm:ml-2 sm:text-4xl">ai</span>
                    </div>
                </div>

                <div className="mt-8 sm:mt-12 flex flex-col gap-4 sm:gap-6 w-full lg:max-w-none">
                    <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-[#212529] sm:text-5xl lg:text-[5.5rem]">
                        What would you like <br className="hidden lg:block" />to explore?
                    </h1>
                    <p className="text-base font-medium leading-relaxed text-gray-500 sm:text-xl">
                        Choose a recommended topic based on your level, or start a<br className="hidden lg:block" />completely new exploration.
                    </p>
                </div>
            </div>

            {/* Right Column: Cards */}
            <div className="flex w-full flex-1 items-center justify-center p-6 lg:w-1/2 lg:p-10">
                <div className="flex h-full w-full lg:max-h-[850px] flex-col items-center justify-center rounded-[2.5rem] bg-[#f8f9fa] p-6 sm:p-10 lg:p-16">
                    <div className="grid w-full max-w-[600px] grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        {isLoadingRecs ? (
                            <div className="col-span-1 sm:col-span-2 py-20 text-center flex flex-col items-center justify-center gap-4">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-[#212529]"></div>
                                <span className="text-lg font-medium text-gray-500">
                                    Generating recommendations for you...
                                </span>
                            </div>
                        ) : (
                            <>
                                {recommendations.slice(0, 3).map((rec, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSelectRecommendation(rec)}
                                        className={`group relative flex h-48 sm:h-56 cursor-pointer flex-col justify-between overflow-hidden rounded-4xl p-6 sm:p-8 text-left transition-[all,transform] duration-300 ease-out hover:scale-[1.05] hover:shadow-xl hover:z-10 active:scale-[0.98] ${bgColors[idx % bgColors.length]}`}
                                    >
                                        <div className="relative z-10 flex flex-col gap-2">
                                            <span className="text-xl sm:text-2xl font-bold leading-tight text-[#212529] line-clamp-3">
                                                {rec.title}
                                            </span>
                                        </div>
                                        <div className="relative z-10 mt-auto flex w-full items-end justify-between">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/60 text-[#212529] backdrop-blur-sm transition-transform duration-300 group-hover:translate-x-3 group-hover:bg-white">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M5 12h14"></path>
                                                    <path d="m12 5 7 7-7 7"></path>
                                                </svg>
                                            </div>
                                            <span className="text-4xl sm:text-5xl font-black text-[#212529] opacity-10">
                                                0{idx + 1}
                                            </span>
                                        </div>
                                    </button>
                                ))}

                                {/* New Topic Card */}
                                <button
                                    onClick={handleNewTopic}
                                    className="group relative flex h-48 sm:h-56 cursor-pointer flex-col items-center justify-center gap-4 rounded-4xl border-2 border-dashed border-gray-300 bg-white p-6 sm:p-8 transition-[all,transform] duration-300 ease-out hover:scale-[1.05] hover:z-10 hover:border-[#d1fb9f] hover:bg-[#f8fdf1] hover:shadow-xl active:scale-[0.98]"
                                >
                                    <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-gray-50 text-gray-400 transition-colors duration-300 group-hover:bg-[#d1fb9f] group-hover:text-[#212529]">
                                        <Plus className="h-6 w-6 sm:h-8 sm:w-8" strokeWidth={2.5} />
                                    </div>
                                    <span className="text-lg sm:text-xl font-bold text-gray-500 transition-colors duration-300 group-hover:text-[#212529]">
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
