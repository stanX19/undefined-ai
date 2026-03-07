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
    <div className="relative flex min-h-dvh w-full flex-col bg-white font-sans text-[#212529]">
      {/* Top Left Logo */}
      <div className="absolute left-6 top-6 flex items-center gap-3 sm:left-12 sm:top-10 sm:gap-4">
         <img src="/logo.png" alt="Logo" className="h-10 sm:h-22 w-auto object-contain" />
         <div className="flex items-baseline">
           <span className="text-2xl sm:text-4xl font-semibold tracking-tight text-[#212529]">undefined</span>
           <span className="ml-1 sm:ml-2 text-2xl sm:text-4xl font-medium tracking-tight text-[#868e96]">ai</span>
         </div>
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 pb-32 pt-28 sm:px-16 sm:pb-40 sm:pt-24">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          {/* Header Typography */}
          <div className="flex flex-col gap-3 sm:gap-5">
            <h1 className="text-4xl font-semibold tracking-tight text-[#212529] sm:text-5xl lg:text-6xl">
              Welcome
            </h1>
            <h2 className="text-lg font-medium text-gray-500 sm:text-xl lg:text-2xl">
              Select your current education level to get started.
            </h2>
          </div>

          {/* Options Grid - 2 Rows max */}
          <div className="mt-6 sm:mt-8 flex flex-wrap gap-2 sm:gap-3 max-w-[850px] leading-relaxed">
            {[
              "Kindergarten",
              "Primary School",
              "Secondary School",
              "Undergraduate",
              "Graduate",
              "PhD / Research"
            ].map((option) => {
              const isSelected = educationLevel === option;
              return (
                <div key={option} className="p-1 sm:p-1.5">
                  <button
                    onClick={() => setEducationLevel(option)}
                    className={`block cursor-pointer rounded-full px-5 py-3 sm:px-7 sm:py-3.5 text-base sm:text-lg font-medium transition-[all,transform] duration-300 ease-out ${
                      isSelected 
                        ? "bg-[#d1fb9f] text-[#212529] shadow-sm ring-2 ring-[#d1fb9f] ring-offset-2 ring-offset-white scale-[1.05]" 
                        : "bg-[#f8f9fa] text-[#495057] hover:bg-[#e9ecef] hover:text-[#212529] hover:scale-[1.03] active:scale-[0.97]"
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
      <div className="fixed bottom-0 left-0 right-0 flex w-full items-center justify-end gap-4 border-t border-gray-100 bg-white/90 p-6 px-6 backdrop-blur-md sm:gap-6 sm:px-20 sm:p-8">
        <button
          onClick={handleNext}
          disabled={isLoading || !educationLevel}
          className="cursor-pointer rounded-2xl bg-[#d1fb9f] px-10 py-4 sm:px-16 sm:py-5 text-lg sm:text-xl font-semibold text-[#212529] shadow-sm transition-all hover:opacity-90 hover:shadow-md hover:scale-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
        >
          {isLoading ? "Saving..." : "Next"}
        </button>
      </div>
    </div>
  );
}
