import { memo } from "react";
import type { UIModal } from "../../types.ts";
import { parseSafeStyle, ElementRenderer } from "../ElementRenderer.tsx";
import { X } from "lucide-react";
import { useUIStore } from "../../store.ts";

interface ModalElementProps {
    element: UIModal;
}

export const ModalElement = memo(function ModalElement({ element }: ModalElementProps) {
    const { className, style } = parseSafeStyle(element.style);
    const store = useUIStore.getState();

    const handleClose = () => {
        store.updateGlobalState("active_modal_id", null);
    };

    // Stop click events from bubbling up to a potentially clickable overlay
    const handleContentClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    return (
        <div
            className={`relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-2xl ${className}`}
            style={style}
            onClick={handleContentClick}
        >
            <button
                onClick={handleClose}
                className="absolute right-4 top-4 rounded-full p-2 text-text-muted transition-colors hover:bg-(--color-surface-hover) hover:text-text-primary cursor-pointer"
                title="Close modal"
            >
                <X size={20} />
            </button>

            <div className="mt-2 flex flex-col gap-4">
                {element.children.map((childId) => (
                    <ElementRenderer key={childId} elementId={childId} />
                ))}
            </div>
        </div>
    );
});
