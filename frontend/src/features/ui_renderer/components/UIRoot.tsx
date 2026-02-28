import { useUIStore } from "../store.ts";
import { ElementRenderer } from "./ElementRenderer.tsx";

export function UIRoot() {
    const { uiJson, isLoading, error } = useUIStore();

    console.log("[UIRoot] Render cycle triggered. Store state:\n", { uiJson, isLoading, error });

    if (isLoading && !uiJson) {
        return (
            <div className="flex h-full w-full items-center justify-center p-8">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-(--a2ui-primary,var(--color-primary)) border-t-transparent" />
                    <p className="text-sm font-medium text-[var(--color-text-muted)]">Loading workspace...</p>
                </div>
            </div>
        );
    }

    if (error && !uiJson) {
        return (
            <div className="flex h-full w-full items-center justify-center p-8">
                <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-600">
                    <p className="font-medium">Failed to load UI</p>
                    <p className="text-sm opacity-80">{error}</p>
                </div>
            </div>
        );
    }

    if (!uiJson) {
        return (
            <div className="flex h-full w-full items-center justify-center p-8">
                <p className="text-[var(--color-text-muted)]">No Active Scene</p>
            </div>
        );
    }

    const rootId = uiJson.root_id;

    // Render the Modal if active
    const activeModalId = uiJson.global_state?.active_modal_id;

    return (
        <div className="relative h-full w-full flex flex-1 flex-col animate-in fade-in duration-500">
            <ElementRenderer elementId={rootId} />

            {/* Render Modal Overlay */}
            {activeModalId && uiJson.elements[activeModalId] && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
                    <ElementRenderer elementId={activeModalId} />
                </div>
            )}
        </div>
    );
}
