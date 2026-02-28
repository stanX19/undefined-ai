import { memo, useState } from "react";
import type { UICodeBlock } from "../../types.ts";
import { parseSafeStyle } from "../ElementRenderer.tsx";
import { Copy, Check } from "lucide-react";

interface CodeBlockElementProps {
    element: UICodeBlock;
}

export const CodeBlockElement = memo(function CodeBlockElement({ element }: CodeBlockElementProps) {
    const { className, style } = parseSafeStyle(element.style);
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(element.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy text", err);
        }
    };

    return (
        <div className={`w-full overflow-hidden rounded-xl border border-(--color-border) bg-[#1e1e1e] font-mono text-sm shadow-sm ${className}`} style={style}>
            <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-2">
                <span className="text-xs text-gray-400">{element.language || "text"}</span>
                <button
                    onClick={handleCopy}
                    className="flex cursor-pointer items-center gap-1 text-xs text-gray-400 transition-colors hover:text-white"
                    title="Copy to clipboard"
                >
                    {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    {copied ? "Copied" : "Copy"}
                </button>
            </div>
            <div className="overflow-x-auto p-4">
                <pre className="text-gray-300">
                    <code>{element.content}</code>
                </pre>
            </div>
        </div>
    );
});
