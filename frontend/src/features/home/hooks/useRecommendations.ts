import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "../../auth/hooks/useAuthStore";
import { useTopicListStore, fetchTopics } from "../../workspace/hooks/useTopicList";

export interface Recommendation {
  title: string;
  difficulty: number;
  reason: string;
}

export function useRecommendations() {
  const userId = useAuthStore((s) => s.userId);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const hasFetched = useRef(false);

  const fetchRecommendations = useCallback(async () => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    await fetchTopics();

    const currentTopics = useTopicListStore.getState().topics;
    const eduLevel = useAuthStore.getState().educationLevel;

    if (currentTopics.length === 0 && !eduLevel) {
      setNeedsOnboarding(true);
      return;
    }

    setIsLoading(true);
    try {
      if (currentTopics.length > 0) {
        const res = await fetch("/api/v1/recommendations/latest", {
          headers: { "X-User-Id": userId! },
        });
        if (res.ok) {
          const data = await res.json();
          setRecommendations(data.recommendations || []);
        }
      } else if (eduLevel) {
        const res = await fetch(
          `/api/v1/recommendations/default?education_level=${encodeURIComponent(eduLevel)}`
        );
        if (res.ok) {
          const data = await res.json();
          setRecommendations(data.recommendations || []);
        }
      }
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
      hasFetched.current = false;
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return { recommendations, isLoading, needsOnboarding };
}
