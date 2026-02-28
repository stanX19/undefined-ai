import type { A2UIComponentProps } from "../../a2ui/registry.ts";
import { resolveDynamic } from "../../a2ui/resolver.ts";

export function A2UIAvatar({
    definition,
    dataModel,
    scopePrefix,
}: A2UIComponentProps) {
    const imageUrl = resolveDynamic<string>(
        definition.src as string | { path: string } | undefined,
        dataModel,
        scopePrefix,
    );

    const title = (definition.title as string) || "Avatar";
    const initials = title.substring(0, 2).toUpperCase();
    const size = (definition.size as "sm" | "md" | "lg" | "xl") || "md";
    const isAgent = definition.isAgent as boolean;

    let sizeClass = "w-10 h-10 text-sm"; // md
    if (size === "sm") sizeClass = "w-8 h-8 text-xs";
    if (size === "lg") sizeClass = "w-12 h-12 text-base";
    if (size === "xl") sizeClass = "w-16 h-16 text-lg";

    const wrapperClass = `relative inline-flex items-center justify-center overflow-hidden rounded-full shrink-0 ${sizeClass}`;

    // High quality border, shadow, and ring to match Design System
    const modernStyle = isAgent
        ? "bg-gradient-to-tr from-primary to-purple-500 text-white shadow-level1 ring-2 ring-primary/20 ring-offset-2 ring-offset-bg"
        : "bg-surface border border-border text-text-primary shadow-sm";

    return (
        <div className={`${wrapperClass} ${modernStyle} transition-transform hover:scale-105 duration-200`}>
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt={title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        // Fallback to initials if image fails to load
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).parentElement?.classList.add('fallback-visible');
                    }}
                />
            ) : null}
            {/* Initials fallback */}
            <span className={`font-semibold ${imageUrl ? 'hidden group-[.fallback-visible]:block absolute z-10' : ''}`}>
                {initials}
            </span>
            {isAgent && (
                <div className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition-opacity pointer-events-none rounded-full" />
            )}
        </div>
    );
}
