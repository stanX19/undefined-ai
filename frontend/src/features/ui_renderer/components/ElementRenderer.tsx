import { memo } from "react";
import { useUIStore } from "../store.ts";
import type { UISafeStyle } from "../types.ts";

// Import all specific element renderers
import { LinearLayout } from "./elements/LinearLayout.tsx";
import { TextElement } from "./elements/TextElement.tsx";
import { TableElement } from "./elements/TableElement.tsx";
import { GraphElement } from "./elements/GraphElement.tsx";
import { QuizElement } from "./elements/QuizElement.tsx";
import { ButtonElement } from "./elements/ButtonElement.tsx";
import { ProgressElement } from "./elements/ProgressElement.tsx";
import { CodeBlockElement } from "./elements/CodeBlockElement.tsx";
import { ModalElement } from "./elements/ModalElement.tsx";

// Helper to convert protocol styles to Tailwind classes or inline styles
export function parseSafeStyle(style?: UISafeStyle): { className: string; style: React.CSSProperties } {
    if (!style) return { className: "", style: {} };

    const classNames = [];
    const inlineStyles: React.CSSProperties = {};

    if (style.color) inlineStyles.color = style.color;
    if (style.background_color) inlineStyles.backgroundColor = style.background_color;

    // Padding
    if (style.padding) {
        const pMap = { none: "p-0", sm: "p-2", md: "p-4", lg: "p-6", xl: "p-8" };
        classNames.push(pMap[style.padding]);
    }

    // Margin
    if (style.margin) {
        const mMap = { none: "m-0", sm: "m-2", md: "m-4", lg: "m-6", xl: "m-8", auto: "m-auto" };
        classNames.push(mMap[style.margin]);
    }

    // Width
    if (style.width) {
        const wMap = { auto: "w-auto", full: "w-full", half: "w-1/2", third: "w-1/3" };
        classNames.push(wMap[style.width]);
    }

    // Height
    if (style.height) {
        const hMap = { auto: "h-auto", full: "h-full", screen: "h-screen" };
        classNames.push(hMap[style.height]);
    }

    // Flex grow
    if (style.flex_grow === 1) {
        classNames.push("flex-1");
    } else if (style.flex_grow === 0) {
        classNames.push("flex-none");
    }

    return { className: classNames.join(" "), style: inlineStyles };
}

interface ElementRendererProps {
    elementId: string;
}

export const ElementRenderer = memo(function ElementRenderer({ elementId }: ElementRendererProps) {
    const element = useUIStore((state) => state.uiJson?.elements[elementId]);

    if (!element) {
        return null; // Or a fallback placeholder
    }

    // Render the specific element type
    switch (element.type) {
        case "linear_layout":
            return <LinearLayout element={element} />;
        case "text":
            return <TextElement element={element} />;
        case "table":
            return <TableElement element={element} />;
        case "graph":
            return <GraphElement element={element} />;
        case "quiz":
            return <QuizElement element={element} />;
        case "button":
            return <ButtonElement element={element} />;
        case "progress":
            return <ProgressElement element={element} />;
        case "code_block":
            return <CodeBlockElement element={element} />;
        case "modal":
            return <ModalElement element={element} />;

        // Nodes and edges are usually managed by the Graph component directly,
        // but if rendered standalone, we ignore them or render placeholders.
        case "node":
        case "edge":
            return null;

        default:
            console.warn(`Unknown element type: ${(element as any).type}`);
            return (
                <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-600">
                    Unsupported widget: {(element as any).type}
                </div>
            );
    }
});
