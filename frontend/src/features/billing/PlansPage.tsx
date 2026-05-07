import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ArrowLeft, Gift, Gauge } from "lucide-react";
import { apiFetch } from "../../constants/api";
import { useAuthStore } from "../auth/hooks/useAuthStore";

const PLANS = [
  {
    tier: "free",
    name: "Free",
    description: "Perfect for individuals getting started.",
    monthly_price: 0,
    annual_price: 0,
    features: [
      "Up to 3 projects",
      "Basic documentation tools",
      "Community support",
      "Standard templates",
      "Basic analytics",
    ],
  },
  {
    tier: "pro",
    name: "Pro",
    description: "Advanced features for growing teams and businesses.",
    monthly_price: 4,
    annual_price: 40,
    features: [
      "Unlimited projects",
      "Advanced documentation tools",
      "Priority support",
      "Custom templates",
      "Advanced analytics",
      "Team collaboration",
      "API access",
      "Custom integrations",
    ],
  },
  {
    tier: "enterprise",
    name: "Enterprise",
    description: "Complete solution for large organizations and enterprises.",
    monthly_price: 11,
    annual_price: 100,
    features: [
      "Everything in Pro",
      "Dedicated account manager",
      "24/7 phone support",
      "Custom onboarding",
      "Advanced security features",
      "SSO integration",
      "Custom contracts",
      "White-label options",
    ],
  },
];

const TIER_ORDER = ["free", "pro", "enterprise"];
const DAILY_FREE_UNITS_BY_PLAN: Record<string, number> = {
  free: 25,
  pro: 100,
  enterprise: 1000,
};

export function PlansPage() {
  const navigate = useNavigate();
  const planTier = useAuthStore((s) => s.planTier);
  const creditsBalance = useAuthStore((s) => s.creditsBalance);
  const dailyFreeUnits = useAuthStore((s) => s.dailyFreeUnits);
  const unitsUsedToday = useAuthStore((s) => s.unitsUsedToday);
  const setCreditsBalance = useAuthStore((s) => s.setCreditsBalance);
  const setUsageSnapshot = useAuthStore((s) => s.setUsageSnapshot);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annually">("monthly");
  const [usageCode, setUsageCode] = useState("");
  const [redeemStatus, setRedeemStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const getDisplayPrice = (plan: typeof PLANS[number]) =>
    billingPeriod === "annually" ? plan.annual_price : plan.monthly_price;

  const getPriceLabel = (plan: typeof PLANS[number]) => {
    if (plan.monthly_price === 0) return "free forever";
    return billingPeriod === "annually" ? "per year, per user." : "per month, per user.";
  };

  useEffect(() => {
    const syncUsage = async () => {
      try {
        const response = await apiFetch("/api/v1/auth/profile");
        if (!response.ok) return;

        const data = await response.json();
        setCreditsBalance(data.credits_balance ?? 0);
        setUsageSnapshot(data.daily_free_units ?? 0, data.units_used_today ?? 0);
      } catch (error) {
        console.error("Failed to refresh usage snapshot:", error);
      }
    };

    syncUsage();
  }, [setCreditsBalance, setUsageSnapshot]);

  const usageLimit = Math.max(dailyFreeUnits || DAILY_FREE_UNITS_BY_PLAN[planTier] || DAILY_FREE_UNITS_BY_PLAN.free, 0);
  const usagePercent = usageLimit > 0 ? Math.min(100, Math.round((unitsUsedToday / usageLimit) * 100)) : 0;
  const progressWidth = usageLimit > 0 ? `${Math.min(100, (unitsUsedToday / usageLimit) * 100)}%` : "0%";

  const handleRedeemUsageCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = usageCode.trim().toUpperCase();
    if (!code || isRedeeming) return;

    setIsRedeeming(true);
    setRedeemStatus(null);

    try {
      const response = await apiFetch("/api/v1/auth/redeem-usage-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.detail || "Could not redeem this code.");
      }

      setCreditsBalance(data.credits_balance);
      setUsageCode("");
      setRedeemStatus({
        type: "success",
        message: `Added ${data.credits_granted} usage credits.`,
      });
    } catch (error) {
      setRedeemStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Could not redeem this code.",
      });
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <div className="h-dvh w-full bg-[#F7F5F3] font-sans overflow-hidden flex flex-col relative">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');
      `}</style>

      {/* Back nav */}
      <button
        onClick={() => navigate("/home", { replace: true })}
        className="absolute top-5 left-6 md:top-8 md:left-8 z-10 flex items-center gap-1.5 text-sm font-medium text-[#605A57] hover:text-[#37322F] transition-colors cursor-pointer"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="mx-auto w-full max-w-5xl px-6 pb-4 pt-10 md:pt-10 flex flex-col h-full min-h-0">
        {/* Header */}
        <div className="mb-4 shrink-0 text-center">
          <h1 className="text-5xl font-normal tracking-tight text-[#37322F]" style={{ fontFamily: "'Instrument Serif', serif" }}>
            Choose Your Plan
          </h1>
          <p className="mt-1 text-sm text-[#605A57]">
            Start free, upgrade when you're ready.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="mb-8 shrink-0 flex justify-center">
          <div className="relative flex items-center rounded-full bg-[#ECEAE8] p-0.5">
            <div
              className={`absolute top-0.5 h-[calc(100%-4px)] w-[calc(50%-2px)] rounded-full bg-white shadow-sm transition-all duration-300 ease-in-out ${
                billingPeriod === "monthly" ? "left-0.5" : "left-[calc(50%+1px)]"
              }`}
            />
            <button
              onClick={() => setBillingPeriod("monthly")}
              className={`relative z-10 rounded-full px-5 py-1.5 text-[13px] font-medium transition-colors duration-200 ${
                billingPeriod === "monthly" ? "text-[#37322F]" : "text-[#847971]"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod("annually")}
              className={`relative z-10 rounded-full px-5 py-1.5 text-[13px] font-medium transition-colors duration-200 ${
                billingPeriod === "annually" ? "text-[#37322F]" : "text-[#847971]"
              }`}
            >
              Annually
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 min-h-0 shrink">
          {PLANS.map((plan) => {
            const isPro = plan.tier === "pro";
            const isFirst = TIER_ORDER.indexOf(plan.tier) === 0;
            const displayPrice = getDisplayPrice(plan);

            return (
              <div
                key={plan.tier}
                className={`relative flex flex-col rounded-2xl border px-5 pt-5 pb-10 overflow-hidden min-h-0 ${
                  isPro ? "bg-[#37322F] border-[rgba(55,50,47,0.12)]" : "bg-white border-[#E0DEDB]"
                }`}
              >
                {/* Header */}
                <div className="shrink-0">
                  <h3 className={`text-sm font-semibold ${isPro ? "text-[#FBFAF9]" : "text-[#37322F]"}`}>
                    {plan.name}
                  </h3>
                  <p className={`mt-0.5 text-[11px] leading-tight ${isPro ? "text-[#B2AEA9]" : "text-[#847971]"}`}>
                    {plan.description}
                  </p>
                </div>

                {/* Price */}
                <div className="mt-3 mb-2 shrink-0">
                  <div className="flex flex-col gap-0">
                    <div
                      className={`relative h-[36px] flex items-center text-4xl font-medium leading-[36px] ${
                        isPro ? "text-[#F0EFEE]" : "text-[#37322F]"
                      }`}
                      style={{ fontFamily: "'Instrument Serif', serif" }}
                    >
                      <span className="invisible">${displayPrice}</span>
                      <span
                        className="absolute inset-0 flex items-center transition-all duration-500"
                        style={{
                          opacity: billingPeriod === "monthly" ? 1 : 0,
                          transform: `scale(${billingPeriod === "monthly" ? 1 : 0.8})`,
                          filter: `blur(${billingPeriod === "monthly" ? 0 : 4}px)`,
                        }}
                        aria-hidden={billingPeriod !== "monthly"}
                      >
                        ${plan.monthly_price}
                      </span>
                      <span
                        className="absolute inset-0 flex items-center transition-all duration-500"
                        style={{
                          opacity: billingPeriod === "annually" ? 1 : 0,
                          transform: `scale(${billingPeriod === "annually" ? 1 : 0.8})`,
                          filter: `blur(${billingPeriod === "annually" ? 0 : 4}px)`,
                        }}
                        aria-hidden={billingPeriod !== "annually"}
                      >
                        ${plan.annual_price}
                      </span>
                    </div>
                    <p className={`text-[11px] ${isPro ? "text-[#9A9490]" : "text-[#847971]"}`}>
                      {getPriceLabel(plan)}
                    </p>
                  </div>
                </div>

                {/* CTA */}
                <div className="mb-3 shrink-0 mt-3">
                  {isFirst ? (
                    <div className={`w-full rounded-lg px-4 py-1.5 text-center text-xs font-medium border border-[#E0DEDB] text-[#B0ACA8]`}>
                      Current plan
                    </div>
                  ) : (
                    <div
                      className={`w-full rounded-lg px-4 py-1.5 text-center text-xs font-medium opacity-60 ${
                        isPro ? "bg-white/80 text-[#37322F]" : "bg-[#37322F]/60 text-white"
                      }`}
                    >
                      Coming soon
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className={`mb-3 h-px shrink-0 ${isPro ? "bg-white/10" : "bg-[#E0DEDB]"}`} />

                {/* Features */}
                <ul className="flex flex-col gap-2 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check
                        size={14}
                        className={`mt-0.5 shrink-0 ${isPro ? "text-orange-400" : "text-[#9CA3AF]"}`}
                        strokeWidth={2}
                      />
                      <span className={`text-[11px] leading-tight ${isPro ? "text-[#D9D5D2]" : "text-[#605A57]"}`}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-5 shrink-0 grid grid-cols-1 gap-4 lg:grid-cols-2 pb-2">
          <section className="rounded-2xl border border-[#E0DEDB] bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ECEAE8] text-[#37322F]">
                <Gauge size={17} />
              </div>
              <h2 className="text-sm font-semibold text-[#37322F]">Usage Balance</h2>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-[#605A57]">Used today</span>
                <span className="font-semibold text-[#37322F]">{usagePercent}%</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#ECEAE8]">
                <div
                  className="h-full rounded-full bg-[#37322F] transition-all duration-300"
                  style={{ width: progressWidth }}
                />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#605A57]">
                <span className="font-semibold text-[#37322F]">{unitsUsedToday}</span> of{" "}
                <span className="font-semibold text-[#37322F]">{usageLimit}</span> daily units used on your{" "}
                <span className="capitalize">{planTier}</span> plan.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#605A57]">
                Extra usage from codes:{" "}
                <span className="font-semibold text-[#37322F]">{creditsBalance} credits</span>
              </p>
            </div>
          </section>

          <form
            onSubmit={handleRedeemUsageCode}
            className="rounded-2xl border border-[#E0DEDB] bg-white p-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                <Gift size={17} />
              </div>
              <h2 className="text-sm font-semibold text-[#37322F]">Redeem Code</h2>
            </div>
            <div className="mt-5">
              <div className="flex gap-2">
                <input
                  value={usageCode}
                  onChange={(event) => setUsageCode(event.target.value.toUpperCase())}
                  placeholder="Enter code here"
                  disabled={isRedeeming}
                  className="min-w-0 flex-1 rounded-lg border border-[#E0DEDB] bg-[#FAF9F8] px-3 py-2 text-sm uppercase text-[#37322F] outline-none transition-colors placeholder:normal-case placeholder:text-[#A39B95] focus:border-[#37322F] disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={!usageCode.trim() || isRedeeming}
                  className="shrink-0 rounded-lg bg-[#37322F] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2A2520] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#37322F]"
                >
                  {isRedeeming ? "Adding..." : "Redeem"}
                </button>
              </div>
              {redeemStatus && (
                <p
                  className={`mt-2 text-xs font-medium ${
                    redeemStatus.type === "success" ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {redeemStatus.message}
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
