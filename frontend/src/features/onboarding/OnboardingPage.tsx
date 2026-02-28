import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAuthStore } from "../auth/hooks/useAuthStore";

export function OnboardingPage() {
  const navigate = useNavigate();
  const [educationLevel, setEducationLevel] = useState("Undergraduate");
  const [isLoading, setIsLoading] = useState(false);
  const userId = useAuthStore((s) => s.userId);
  const setEducationLevelInStore = useAuthStore((s) => s.setEducationLevel);

  const handleGetStarted = async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      // Save the education level to the database
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, education_level: educationLevel }),
      });

      if (res.ok) {
        setEducationLevelInStore(educationLevel);
        navigate("/menu");
      } else {
        console.error("Failed to save education level");
      }
    } catch (err) {
      console.error("Error saving education level:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full min-h-dvh flex-col items-center justify-center bg-(--color-bg) p-6 text-center">
      <div className="flex w-full max-w-lg flex-col items-center gap-6 rounded-3xl border border-border bg-surface p-12 shadow-(--shadow-level2)">
        <div className="flex items-center justify-center">
          <img src="/logo.png" alt="Logo" className="h-35 w-auto object-contain" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl leading-[1.2] text-text-primary">
            Welcome to{" "}
            <span className="font-bold tracking-tight text-[#212529]">undefined</span>
            <span className="ml-1 font-medium tracking-normal text-[#868e96]">ai</span>
          </h1>
          <p className="text-[14px] leading-relaxed text-text-muted">
            Your AI-powered learning platform. Start exploring any topic — the
            UI adapts to your needs and creates custom interfaces on the fly.
          </p>
        </div>

        <div className="flex w-full flex-col items-center gap-4 pt-2">
          <p className="text-[14px] font-medium text-text-secondary">
            Select your current education level to get started.
          </p>
          <div className="grid w-full grid-cols-2 gap-3">
            {[
              "Kindergarten",
              "Primary School",
              "Secondary School",
              "Undergraduate",
              "Graduate",
              "PhD / Research",
            ].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setEducationLevel(option)}
                className={`flex items-center justify-center rounded-xl px-4 py-2.5 text-[14px] font-medium transition-colors cursor-pointer ${educationLevel === option
                    ? "bg-[#212529] text-white"
                    : "bg-[#f1f3f5] text-[#212529] hover:bg-[#e9ecef]"
                  }`}
              >
                {option}
              </button>
            ))}
          </div>
          <button
            onClick={handleGetStarted}
            disabled={isLoading || !educationLevel}
            className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-[14px] font-medium text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              "Saving..."
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Get Started
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
