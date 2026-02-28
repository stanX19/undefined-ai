import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";

export function OnboardingPage() {
  const navigate = useNavigate();

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

        <button
          onClick={() => navigate("/workspace")}
          className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-full bg-sidebar px-8 py-3.5 text-[14px] font-medium text-white transition-all hover:opacity-90 active:scale-95"
        >
          <Sparkles className="h-4 w-4" />
          Get Started
        </button>
      </div>
    </div>
  );
}
