import type { A2UIComponentProps } from "../../a2ui/registry.ts";
import { resolveDynamic } from "../../a2ui/resolver.ts";

export function A2UIProgress({
    definition,
    dataModel,
    scopePrefix,
}: A2UIComponentProps) {
    const value = resolveDynamic<number>(
        definition.value as number | { path: string } | undefined,
        dataModel,
        scopePrefix,
    ) ?? 0;

    const max = (definition.max as number) ?? 100;
    const variant = (definition.variant as string) ?? "bar"; // bar or ring
    const label = definition.label as string | undefined;

    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    if (variant === "ring") {
        // A modern SVG progress ring
        const radius = 20;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (percentage / 100) * circumference;

        return (
            <div className="flex flex-col items-center justify-center gap-2">
                <div className="relative inline-flex items-center justify-center filter drop-shadow-sm">
                    <svg className="transform -rotate-90 w-14 h-14">
                        <circle
                            cx="28"
                            cy="28"
                            r={radius}
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="transparent"
                            className="text-border"
                        />
                        <circle
                            cx="28"
                            cy="28"
                            r={radius}
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="transparent"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            className="text-primary transition-all duration-700 ease-out"
                            strokeLinecap="round"
                        />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-xs font-semibold text-text-primary">
                        {Math.round(percentage)}%
                    </div>
                </div>
                {label && <span className="text-xs font-medium text-text-muted">{String(label)}</span>}
            </div>
        );
    }

    // Linear progress bar
    return (
        <div className="w-full flex flex-col gap-1.5">
            {(label || !!definition.showValue) && (
                <div className="flex justify-between items-center text-xs font-medium mb-0.5">
                    {label && <span className="text-text-primary">{String(label)}</span>}
                    {!!definition.showValue && <span className="text-text-muted">{Math.round(percentage)}%</span>}
                </div>
            )}
            <div className="w-full h-2 bg-border rounded-full overflow-hidden shadow-inner">
                <div
                    className="h-full bg-primary rounded-full transition-all duration-700 ease-out relative overflow-hidden"
                    style={{ width: `${percentage}%` }}
                >
                    {/* Subtle shimmering effect for modern look */}
                    <div className="absolute inset-0 bg-white/20 -skew-x-12 translate-x-[-150%] animate-[shimmer_2s_infinite]"></div>
                </div>
            </div>
        </div>
    );
}
