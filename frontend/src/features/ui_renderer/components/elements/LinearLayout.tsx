import { memo } from "react";
import type { UILinearLayout } from "../../types.ts";
import { ElementRenderer, parseSafeStyle } from "../ElementRenderer.tsx";

interface LinearLayoutProps {
    element: UILinearLayout;
}

export const LinearLayout = memo(function LinearLayout({ element }: LinearLayoutProps) {
    const { className, style } = parseSafeStyle(element.style);

    const orientationClass = element.orientation === "horizontal" ? "flex flex-row" : "flex flex-col";

    // Default gap to md (1rem) if not customized in class
    const gapClass = "gap-4";

    return (
        <div
            className={`${orientationClass} ${gapClass} ${className} items-start w-full`}
            style={style}
        >
            {element.children.map((childId) => (
                <ElementRenderer key={childId} elementId={childId} />
            ))}
        </div>
    );
});
