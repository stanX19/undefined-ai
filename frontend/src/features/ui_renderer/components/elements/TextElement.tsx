import { memo } from "react";
import ReactMarkdown from "react-markdown";
import type { UIText } from "../../types.ts";
import { parseSafeStyle } from "../ElementRenderer.tsx";

interface TextElementProps {
    element: UIText;
}

export const TextElement = memo(function TextElement({ element }: TextElementProps) {
    const { className, style } = parseSafeStyle(element.style);

    return (
        <div className={`prose prose-sm w-full max-w-none text-(--a2ui-text,var(--color-text-primary)) ${className}`} style={{ ...style, width: '100%' }}>
            {element.media_url && element.media_type === "image" && (
                <img src={element.media_url} alt="Text content media" className="mb-4 rounded-xl shadow border border-(--color-border)" />
            )}

            {element.media_url && element.media_type === "video" && (
                <video controls src={element.media_url} className="mb-4 w-full rounded-xl shadow border border-(--color-border)" />
            )}

            {element.media_url && element.media_type === "audio" && (
                <audio controls src={element.media_url} className="mb-4 w-full" />
            )}

            <ReactMarkdown>{element.content}</ReactMarkdown>
        </div>
    );
});
