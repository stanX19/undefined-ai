import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";

import { useAuthStore } from "../hooks/useAuthStore";

export function RegisterPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
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
        if (!email.trim() || !password || !confirmPassword) return;

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/v1/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim(), password }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                // Extract readable error from FastAPI validation errors
                if (data?.detail && Array.isArray(data.detail)) {
                    const msg = data.detail.map((d: any) => d.msg).join(". ");
                    throw new Error(msg);
                }
                throw new Error(data?.detail || "Registration failed");
            }

            const data = await response.json();
            login(data.access_token, data.user_id, data.email, data.education_level);

            navigate("/onboarding");
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
                {/* Top Left Logo */}
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
                            Create your account
                        </h1>
                        <p className="text-[#605A57] text-base font-normal leading-7 font-sans">
                            Start your learning journey today,
                            <br />
                            explore topics that spark your curiosity.
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
                                placeholder="Password (min 8 chars, 1 letter, 1 number)"
                                className="w-full rounded-full border border-[#E0DEDB] bg-white px-5 py-4 sm:px-6 sm:py-5 text-base text-[#37322F] font-sans transition-all placeholder:text-[#605A57]/70 focus:border-[#37322F] focus:outline-none focus:ring-2 focus:ring-[rgba(55,50,47,0.15)] disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={isLoading}
                            />
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm password"
                                className="w-full rounded-full border border-[#E0DEDB] bg-white px-5 py-4 sm:px-6 sm:py-5 text-base text-[#37322F] font-sans transition-all placeholder:text-[#605A57]/70 focus:border-[#37322F] focus:outline-none focus:ring-2 focus:ring-[rgba(55,50,47,0.15)] disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={isLoading}
                            />
                            {error && (
                                <p className="mt-1 text-sm font-medium text-red-600 px-4 font-sans">{error}</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={!email.trim() || !password || !confirmPassword || isLoading}
                            className="relative flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#37322F] px-8 py-4 sm:py-5 text-[13px] font-medium text-white font-sans shadow-[0px_0px_0px_2.5px_rgba(255,255,255,0.08)_inset] transition-all hover:bg-[#2A2520] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#37322F]"
                        >
                            {isLoading ? "Creating account..." : "Register"}
                        </button>
                    </form>

                    <p className="mt-10 text-center text-[13px] font-medium text-[#605A57] font-sans">
                        Already have an account?{" "}
                        <Link to="/login" className="text-[#37322F] font-semibold hover:underline cursor-pointer">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>

            {/* Right Column: Graphic */}
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
