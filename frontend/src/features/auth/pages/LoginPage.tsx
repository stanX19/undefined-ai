import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAuthStore } from "../hooks/useAuthStore";

export function LoginPage() {
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = inputValue.trim();
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: id }),
      });

      if (!response.ok) {
        throw new Error("Failed to login");
      }

      const data = await response.json();
      login(id, data.education_level);

      navigate("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center bg-bg p-6 text-center">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl border border-border bg-surface p-8 shadow-level2">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-8 w-8" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold leading-[1.2] text-text-primary">
            Welcome to undefined ai
          </h1>
          <p className="text-[14px] leading-relaxed text-text-muted">
            Please enter your user ID to sign in.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter your User ID"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
            disabled={isLoading}
          />
          {error && <p className="text-sm text-error-text">{error}</p>}
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-8 py-3.5 text-[14px] font-medium text-white transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
