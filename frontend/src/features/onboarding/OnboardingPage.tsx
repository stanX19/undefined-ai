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
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-8 w-8" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold leading-[1.2] text-text-primary">
            Welcome to undefined ai
          </h1>
          <p className="text-[14px] leading-relaxed text-text-muted">
            Your AI-powered learning platform. Start exploring any topic — the
            UI adapts to your needs and creates custom interfaces on the fly.
          </p>
        </div>

        <div className="flex w-full flex-col gap-4 pt-4">
          <label className="text-sm font-medium text-text-secondary text-left">
            Before we recommend topics, what is your current education level?
          </label>
          <select
            value={educationLevel}
            onChange={(e) => setEducationLevel(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-xl border border-border bg-surface-alt px-4 py-3 text-[14px] text-text-primary outline-none focus:border-primary disabled:opacity-50"
          >
            <option value="Primary School">Primary School</option>
            <option value="Secondary School">Secondary School</option>
            <option value="Undergraduate">Undergraduate</option>
            <option value="Graduate">Graduate</option>
            <option value="Professional / Self-Taught">Professional / Self-Taught</option>
          </select>
          <button
            onClick={handleGetStarted}
            disabled={isLoading}
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
