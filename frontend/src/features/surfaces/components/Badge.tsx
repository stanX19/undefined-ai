import type { A2UIComponentProps } from "../../a2ui/registry.ts";
import { resolveDynamic } from "../../a2ui/resolver.ts";

export function A2UIBadge({
    definition,
    dataModel,
    scopePrefix,
}: A2UIComponentProps) {
    const text = resolveDynamic<string>(
        definition.text as string | { path: string } | undefined,
        dataModel,
        scopePrefix,
    ) ?? definition.label ?? "Badge";

    const status = (definition.status as string) || "default";

    // Base styling for the badge
    const baseClass = "inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border transition-colors";

    let variantClass = "bg-gray-100 text-gray-800 border-gray-200";

    switch (status) {
        case "success":
            variantClass = "bg-success text-success-text border-[rgba(34,197,94,0.2)]";
            break;
        case "warning":
            variantClass = "bg-warning text-warning-text border-[rgba(249,115,22,0.2)]";
            break;
        case "error":
            variantClass = "bg-error text-error-text border-[rgba(239,68,68,0.2)]";
            break;
        case "in-progress":
            variantClass = "bg-in-progress text-in-progress-text border-[rgba(216,180,254,0.3)] shadow-[0_0_8px_rgba(216,180,254,0.4)]";
            break;
        case "primary":
            variantClass = "bg-subtle-blue text-primary border-[rgba(79,70,229,0.2)]";
            break;
    }

    return (
        <span className={`${baseClass} ${variantClass}`}>
            {status === "in-progress" && (
                <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3 text-in-progress-text" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            )}
            {text as string}
        </span>
    );
}
