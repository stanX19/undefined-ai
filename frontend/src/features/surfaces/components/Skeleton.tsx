import type { A2UIComponentProps } from "../../a2ui/registry.ts";

export function A2UISkeleton({ definition }: A2UIComponentProps) {
    const variant = (definition.variant as "text" | "circular" | "rectangular" | "rounded") || "rounded";
    const width = definition.width as string | number | undefined;
    const height = definition.height as string | number | undefined;

    let className = "animate-pulse bg-gray-200 dark:bg-slate-700";

    switch (variant) {
        case "text":
            className += " rounded-md w-full h-4";
            break;
        case "circular":
            className += " rounded-full";
            // Default dimensions for circular if not specified
            if (!width && !height) {
                className += " w-10 h-10";
            }
            break;
        case "rectangular":
            className += " w-full h-32";
            break;
        case "rounded":
        default:
            className += " rounded-xl w-full h-32";
            break;
    }

    const style: React.CSSProperties = {};
    if (width) style.width = typeof width === "number" ? `${width}px` : width;
    if (height) style.height = typeof height === "number" ? `${height}px` : height;

    return <div className={className} style={style} aria-hidden="true" />;
}
