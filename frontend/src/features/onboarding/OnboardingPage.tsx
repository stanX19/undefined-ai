import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../auth/hooks/useAuthStore";

export function OnboardingPage() {
  const navigate = useNavigate();
  const [educationLevel, setEducationLevel] = useState("Undergraduate");
  const [isLoading, setIsLoading] = useState(false);
  const userId = useAuthStore((s) => s.userId);
  const setEducationLevelInStore = useAuthStore((s) => s.setEducationLevel);

  const handleNext = async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
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

  const options = [
    "Kindergarten",
    "Primary School",
    "Secondary School",
    "Undergraduate",
    "Graduate",
    "PhD / Research",
  ];

  return (
    <div className="relative flex min-h-dvh w-full flex-col bg-[#F7F5F3] font-sans">
      {/* Top Left Logo - matches LoginPage */}
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

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 pb-32 pt-28 sm:px-16 sm:pb-40 sm:pt-24">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <div className="flex flex-col gap-3 sm:gap-5">
            <h1 className="text-[#49423D] text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl font-sans">
              Welcome
            </h1>
            <h2 className="text-[#605A57] text-lg font-medium leading-7 sm:text-xl lg:text-2xl font-sans">
              Select your current education level to get started.
            </h2>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 sm:mt-8 sm:gap-3 max-w-[850px] leading-relaxed">
            {options.map((option) => {
              const isSelected = educationLevel === option;
              return (
                <div key={option} className="p-1 sm:p-1.5">
                  <button
                    onClick={() => setEducationLevel(option)}
                    type="button"
                    className={`block cursor-pointer rounded-full px-5 py-3 sm:px-7 sm:py-3.5 text-base sm:text-lg font-medium font-sans transition-colors duration-200 ${
                      isSelected
                        ? "bg-orange-500 text-white shadow-sm ring-2 ring-orange-400 ring-offset-2 ring-offset-[#F7F5F3]"
                        : "bg-white border border-[#E0DEDB] text-[#605A57] hover:bg-[#FAF9F8] hover:text-[#37322F] hover:border-[rgba(55,50,47,0.12)]"
                    }`}
                  >
                    {option}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 flex w-full items-center justify-end gap-4 border-t border-[rgba(55,50,47,0.12)] bg-[#F7F5F3]/95 p-6 px-6 backdrop-blur-md sm:gap-6 sm:px-20 sm:p-8">
        <button
          onClick={handleNext}
          disabled={isLoading || !educationLevel}
          type="button"
          className="relative cursor-pointer rounded-full bg-[#37322F] px-10 py-4 sm:px-16 sm:py-5 text-[13px] font-medium text-white font-sans shadow-[0px_0px_0px_2.5px_rgba(255,255,255,0.08)_inset] transition-all hover:bg-[#2A2520] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Saving..." : "Next"}
        </button>
      </div>
    </div>
  );
}
