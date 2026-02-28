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
        <div className={`w-full max-w-none text-(--a2ui-text,var(--color-text-primary)) [&_h1]:text-2xl [&_h1]:md:text-3xl [&_h1]:font-extrabold [&_h1]:tracking-tight [&_h1]:text-slate-900 [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-slate-800 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:text-[15px] [&_p]:leading-relaxed [&_p]:text-slate-600 [&_p]:mb-4 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ul]:text-slate-600 [&_li]:mb-1.5 [&_a]:text-blue-500 [&_a]:hover:underline ${className}`} style={{ ...style, width: '100%' }}>
            {element.media_url && element.media_type === "image" && (
                <img src={element.media_url} alt="Text content media" className="mb-6 rounded-2xl shadow-sm border border-slate-200 object-cover w-full max-h-[450px]" />
            )}

            {element.media_url && element.media_type === "video" && (
                <video controls src={element.media_url} className="mb-6 w-full rounded-2xl shadow-sm border border-slate-200" />
            )}

            {element.media_url && element.media_type === "audio" && (
                <audio controls src={element.media_url} className="mb-6 w-full" />
            )}

            <ReactMarkdown>{element.content}</ReactMarkdown>
        </div>
    );
});
