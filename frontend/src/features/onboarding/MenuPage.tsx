import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Compass } from "lucide-react";
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
    const topics = useTopicListStore((s) => s.topics);
    const isLoadingTopics = useTopicListStore((s) => s.isLoading);
    const clearChat = useChatStore((s) => s.clear);
    const setTopicId = useChatStore((s) => s.setTopicId);

    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [isLoadingRecs, setIsLoadingRecs] = useState(false);

    useEffect(() => {
        fetchTopics();
    }, []);

    const educationLevelFromAuth = useAuthStore((s) => s.educationLevel);

    useEffect(() => {
        if (isLoadingTopics) return;

        const fetchRecommendations = async () => {
            setIsLoadingRecs(true);
            try {
                if (topics.length > 0) {
                    // Fetch recommendations based on the user's latest topic via the new endpoint
                    const res = await fetch(`/api/v1/recommendations/latest?user_id=${userId}`);
                    if (res.ok) {
                        const data = await res.json();
                        setRecommendations(data.recommendations || []);
                    }
                } else if (educationLevelFromAuth) {
                    // No topics, but user already has an education level set
                    const res = await fetch(`/api/v1/recommendations/default?education_level=${encodeURIComponent(educationLevelFromAuth)}`);
                    if (res.ok) {
                        const data = await res.json();
                        setRecommendations(data.recommendations || []);
                    }
                } else if (!educationLevelFromAuth) {
                    navigate("/onboarding");
                }
            } catch (err) {
                console.error("Failed to fetch recommendations:", err);
            } finally {
                setIsLoadingRecs(false);
            }
        };

        if (topics.length > 0 || educationLevelFromAuth) {
            fetchRecommendations();
        }
    }, [topics, isLoadingTopics, userId, educationLevelFromAuth]);

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
            <div className="flex h-full min-h-dvh items-center justify-center bg-(--color-bg)">
                <span className="text-text-muted">Loading your workspace...</span>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-dvh flex-col items-center justify-center bg-(--color-bg) p-6 text-center">
            <div className="flex w-full max-w-lg flex-col items-center gap-6 rounded-3xl border border-border bg-surface p-8 shadow-(--shadow-level2)">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Compass className="h-8 w-8" />
                </div>

                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-semibold leading-[1.2] text-text-primary">
                        What would you like to explore?
                    </h1>
                    <p className="text-[14px] leading-relaxed text-text-muted">
                        Choose a recommended topic or start a completely new exploration.
                    </p>
                </div>

                <div className="grid w-full grid-cols-2 gap-4">
                    {isLoadingRecs ? (
                        <div className="col-span-2 py-8 text-sm text-text-muted">
                            Generating recommendations for you...
                        </div>
                    ) : (
                        <>
                            {recommendations.slice(0, 3).map((rec, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleSelectRecommendation(rec)}
                                    className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-border bg-surface-alt p-4 text-center transition-all hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm"
                                >
                                    <span className="line-clamp-2 text-sm font-medium text-text-primary">
                                        {rec.title}
                                    </span>
                                </button>
                            ))}

                            {/* The 4th button is always the + "New Topic" button */}
                            <button
                                onClick={handleNewTopic}
                                className="flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-transparent p-4 transition-all hover:border-primary hover:bg-primary/5 hover:text-primary"
                            >
                                <Plus className="h-8 w-8 text-text-muted group-hover:text-primary transition-colors" />
                                <span className="text-sm font-medium text-text-muted group-hover:text-primary">
                                    New Topic
                                </span>
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
