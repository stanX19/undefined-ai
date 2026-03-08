import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useAuthStore } from "../hooks/useAuthStore";

export function LoginPage() {
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const images = ["/image1.png", "/image2.png", "/image3.png"];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [images.length]);

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
    <div className="flex min-h-dvh lg:h-dvh w-full flex-col lg:flex-row bg-white font-sans text-[#212529]">
      {/* Left Column: Form */}
      <div className="relative flex w-full flex-col lg:w-1/2 overflow-y-auto">
        {/* Top Left Logo */}
        <div className="absolute left-6 top-6 z-20 flex max-w-[calc(100vw-3rem)] items-center gap-2.5 sm:left-16 sm:top-10 sm:gap-4 lg:left-22">
          <img src="/logo.png" alt="Logo" className="h-8 w-auto shrink-0 object-contain sm:h-14" />
          <div className="flex min-w-0 items-baseline">
            <span className="truncate text-xl font-semibold tracking-tight text-[#212529] sm:text-4xl">undefined</span>
            <span className="ml-1 shrink-0 text-xl font-medium tracking-tight text-[#868e96] sm:ml-2 sm:text-4xl">ai</span>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-[500px] flex-1 flex-col justify-center px-6 pt-28 pb-12 sm:px-12 sm:pt-40">
          <div className="flex flex-col gap-2 items-center text-center">
            <h1 className="text-3xl font-bold tracking-tight text-[#212529] sm:text-4xl lg:text-5xl">
              Welcome back!
            </h1>
            <p className="mt-2 sm:mt-3 text-sm sm:text-base font-normal text-gray-500">
              Learning should feed interest,<br/>
              with every click, your curiosity gets fueled.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 sm:mt-10 flex w-full flex-col gap-5 sm:gap-6">
            <div className="flex flex-col gap-1">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="User ID"
                className="w-full rounded-full border border-gray-300 bg-white px-5 py-4 sm:px-6 sm:py-5 text-base transition-all focus:border-[#d1fb9f] focus:outline-none focus:ring-4 focus:ring-[#d1fb9f]/30"
                autoFocus
                disabled={isLoading}
              />
              {error && <p className="mt-1 text-sm font-medium text-red-500 px-4">{error}</p>}
            </div>
            
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#d1fb9f] px-8 py-4 sm:py-5 text-base sm:text-lg font-semibold text-[#212529] shadow-sm transition-all hover:opacity-90 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            >
              {isLoading ? "Signing in..." : "Login"}
            </button>
          </form>

          <div className="mt-8 sm:mt-10 flex items-center justify-center gap-4">
            <div className="h-px flex-1 bg-gray-200"></div>
            <span className="text-xs sm:text-sm font-medium text-gray-400">or continue with</span>
            <div className="h-px flex-1 bg-gray-200"></div>
          </div>

          <div className="mt-6 flex w-full">
            {/* Social Buttons (Visual Only) */}
            <button className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-full bg-[#212529] px-8 py-3.5 sm:py-4 text-sm sm:text-base font-medium text-white transition-all hover:bg-[#343a40] hover:scale-[1.02] active:scale-[0.98]">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="currentColor">
                <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.66 15.63 16.92 16.8 15.75 17.58V20.34H19.32C21.41 18.42 22.56 15.6 22.56 12.25Z" />
                <path d="M12 23C14.97 23 17.46 22.02 19.32 20.34L15.75 17.58C14.74 18.26 13.48 18.67 12 18.67C9.14 18.67 6.71 16.74 5.84 14.15H2.15V17.01C3.96 20.61 8.67 23 12 23Z" />
                <path d="M5.84 14.15C5.62 13.48 5.49 12.76 5.49 12C5.49 11.24 5.62 10.52 5.84 9.85V6.99H2.15C1.41 8.46 1 10.17 1 12C1 13.83 1.41 15.54 2.15 17.01L5.84 14.15Z" />
                <path d="M12 5.33C13.62 5.33 15.06 5.88 16.2 6.96L19.4 3.76C17.45 1.94 14.96 1 12 1C8.67 1 3.96 3.39 2.15 6.99L5.84 9.85C6.71 7.26 9.14 5.33 12 5.33Z" />
              </svg>
              Sign in with Google
            </button>
          </div>

          <p className="mt-10 sm:mt-12 text-center text-xs sm:text-sm font-medium text-gray-500">
            Not a member? <span className="text-[#212529] font-bold hover:underline cursor-pointer">Register now</span>
          </p>
        </div>
      </div>

      {/* Right Column: Graphic */}
      <div className="hidden lg:flex w-1/2 relative h-full items-center justify-center bg-gray-100 overflow-hidden">
        {images.map((src, index) => (
          <img
            key={src}
            src={src}
            alt={`Slide ${index + 1}`}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out ${
              index === currentImageIndex ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
