import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";

import { useAuthStore } from "../hooks/useAuthStore";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    if (!email.trim() || !password) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.detail || "Invalid email or password");
      }

      const data = await response.json();
      login(data.access_token, data.user_id, data.email, data.education_level);

      if (data.education_level) {
        navigate("/menu");
      } else {
        navigate("/onboarding");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh lg:h-dvh w-full flex-col lg:flex-row bg-[#F7F5F3] font-sans">
      {/* Left Column: Form */}
      <div className="relative flex w-full flex-col lg:w-1/2 overflow-y-auto">
        {/* Top Left Logo - matches landing nav brand */}
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

        <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center px-6 pt-28 pb-12 sm:px-10 sm:pt-36">
          <div className="flex flex-col gap-3 items-center text-center">
            <h1 className="text-[#49423D] text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[2.5rem] font-sans">
              Welcome back
            </h1>
            <p className="text-[#605A57] text-base font-normal leading-7 font-sans">
              Learning should feed interest,
              <br />
              with every click, your curiosity gets fueled.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-10 flex w-full flex-col gap-5 sm:gap-6">
            <div className="flex flex-col gap-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full rounded-full border border-[#E0DEDB] bg-white px-5 py-4 sm:px-6 sm:py-5 text-base text-[#37322F] font-sans transition-all placeholder:text-[#605A57]/70 focus:border-[#37322F] focus:outline-none focus:ring-2 focus:ring-[rgba(55,50,47,0.15)] disabled:cursor-not-allowed disabled:opacity-60"
                autoFocus
                disabled={isLoading}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-full border border-[#E0DEDB] bg-white px-5 py-4 sm:px-6 sm:py-5 text-base text-[#37322F] font-sans transition-all placeholder:text-[#605A57]/70 focus:border-[#37322F] focus:outline-none focus:ring-2 focus:ring-[rgba(55,50,47,0.15)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoading}
              />
              {error && (
                <p className="mt-1 text-sm font-medium text-red-600 px-4 font-sans">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!email.trim() || !password || isLoading}
              className="relative flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#37322F] px-8 py-4 sm:py-5 text-[13px] font-medium text-white font-sans shadow-[0px_0px_0px_2.5px_rgba(255,255,255,0.08)_inset] transition-all hover:bg-[#2A2520] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#37322F]"
            >
              {isLoading ? "Signing in..." : "Login"}
            </button>
          </form>

          <div className="mt-10 flex items-center justify-center gap-4">
            <div className="h-px flex-1 bg-[rgba(55,50,47,0.12)]" />
            <span className="text-[13px] font-medium text-[#605A57] font-sans">
              or continue with
            </span>
            <div className="h-px flex-1 bg-[rgba(55,50,47,0.12)]" />
          </div>

          <div className="mt-6 flex w-full relative">
            <span className="absolute -top-1.5 right-2 z-10 px-1.5 py-0.5 rounded-md bg-orange-500 text-white text-[10px] font-medium font-sans leading-tight">
              Coming Soon
            </span>
            <button
              type="button"
              className="relative flex w-full cursor-pointer items-center justify-center gap-3 rounded-full border border-[#E0DEDB] bg-white px-8 py-4 sm:py-5 text-[13px] font-medium text-[#37322F] font-sans transition-all hover:bg-[#FAF9F8] hover:border-[rgba(55,50,47,0.12)]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                className="h-4 w-4 sm:h-5 sm:w-5 text-[#605A57]"
                fill="currentColor"
              >
                <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.66 15.63 16.92 16.8 15.75 17.58V20.34H19.32C21.41 18.42 22.56 15.6 22.56 12.25Z" />
                <path d="M12 23C14.97 23 17.46 22.02 19.32 20.34L15.75 17.58C14.74 18.26 13.48 18.67 12 18.67C9.14 18.67 6.71 16.74 5.84 14.15H2.15V17.01C3.96 20.61 8.67 23 12 23Z" />
                <path d="M5.84 14.15C5.62 13.48 5.49 12.76 5.49 12C5.49 11.24 5.62 10.52 5.84 9.85V6.99H2.15C1.41 8.46 1 10.17 1 12C1 13.83 1.41 15.54 2.15 17.01L5.84 14.15Z" />
                <path d="M12 5.33C13.62 5.33 15.06 5.88 16.2 6.96L19.4 3.76C17.45 1.94 14.96 1 12 1C8.67 1 3.96 3.39 2.15 6.99L5.84 9.85C6.71 7.26 9.14 5.33 12 5.33Z" />
              </svg>
              Sign in with Google
            </button>
          </div>

          <p className="mt-10 text-center text-[13px] font-medium text-[#605A57] font-sans">
            Don't have an account?{" "}
            <Link to="/register" className="text-[#37322F] font-semibold hover:underline cursor-pointer">
              Register now
            </Link>
          </p>
        </div>
      </div>

      {/* Right Column: Graphic - matches landing soft tones */}
      <div className="hidden lg:flex w-1/2 relative h-full items-center justify-center bg-[#FAF9F8] overflow-hidden border-l border-[rgba(55,50,47,0.12)]">
        {images.map((src, index) => (
          <img
            key={src}
            src={src}
            alt={`Slide ${index + 1}`}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out ${index === currentImageIndex ? "opacity-100" : "opacity-0"
              }`}
          />
        ))}
      </div>
    </div>
  );
}
