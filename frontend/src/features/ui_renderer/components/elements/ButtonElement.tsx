import { memo } from "react";
import type { UIButton } from "../../types.ts";
import { parseSafeStyle } from "../ElementRenderer.tsx";
import { generateEventHandlers } from "../../actionHandler.ts";
import { Loader2 } from "lucide-react";

interface ButtonElementProps {
    element: UIButton;
}

export const ButtonElement = memo(function ButtonElement({ element }: ButtonElementProps) {
    const { className, style } = parseSafeStyle(element.style);
    const handlers = generateEventHandlers(element.events);

    const isLoading = element.state === "loading";
    const isDisabled = element.state === "disabled" || isLoading;

    return (
        <button
            className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-(--a2ui-primary,var(--color-primary)) px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:pointer-events-none disabled:opacity-50 ${className}`}
            style={style}
            disabled={isDisabled}
            aria-label={element.accessibility?.aria_label || element.label}
            {...handlers}
        >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {element.label}
        </button>
    );
});
