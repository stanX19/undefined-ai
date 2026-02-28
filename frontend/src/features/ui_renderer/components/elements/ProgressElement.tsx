import { memo } from "react";
import type { UIProgress } from "../../types.ts";
import { parseSafeStyle } from "../ElementRenderer.tsx";

interface ProgressElementProps {
    element: UIProgress;
}

export const ProgressElement = memo(function ProgressElement({ element }: ProgressElementProps) {
    const { className, style } = parseSafeStyle(element.style);

    // Guard against divide by zero
    const max = Math.max(element.max, 1);
    const percentage = Math.min(Math.max((element.value / max) * 100, 0), 100);

    return (
        <div className={`flex w-full flex-col gap-1.5 ${className}`} style={style}>
            <div className="flex justify-between text-xs font-medium text-(--a2ui-text,var(--color-text-muted))">
                <span>Progress</span>
                <span>{Math.round(percentage)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-(--color-border)">
                <div
                    className="h-full bg-(--a2ui-primary,var(--color-primary)) transition-all duration-500 ease-out"
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
});
