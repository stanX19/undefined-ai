import { useState } from "react";
import { useAuthStore } from "../hooks/useAuthStore";

export function LoginModal() {
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { userId, login } = useAuthStore();

  if (userId) return null;

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

      login(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--color-surface)] p-6 shadow-xl border border-[var(--color-border)]">
        <h2 className="mb-2 text-xl font-semibold">Welcome to undefined ai</h2>
        <p className="mb-6 text-sm text-[var(--color-text-muted)]">
          Please enter a user ID to start your learning journey.
        </p>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter your User ID"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 py-2.5 text-sm focus:border-[var(--a2ui-primary,var(--color-primary))] focus:outline-none focus:ring-1 focus:ring-[var(--a2ui-primary,var(--color-primary))]"
            autoFocus
            disabled={isLoading}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="w-full cursor-pointer rounded-xl bg-[var(--a2ui-primary,var(--color-primary))] py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {isLoading ? "Loading..." : "Start Learning"}
          </button>
        </form>
      </div>
    </div>
  );
}
