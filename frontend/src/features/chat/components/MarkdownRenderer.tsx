import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';

interface MarkdownRendererProps {
    content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-4 text-[var(--color-text-primary)]">{children}</h1>,
                h2: ({ children }) => <h2 className="text-xl font-semibold mt-5 mb-3 text-[var(--color-text-primary)]">{children}</h2>,
                h3: ({ children }) => <h3 className="text-lg font-medium mt-4 mb-2 text-[var(--color-text-primary)]">{children}</h3>,
                p: ({ children }) => <p className="mb-4 last:mb-0 leading-relaxed text-[var(--color-text-body)]">{children}</p>,
                ul: ({ children }) => <ul className="mb-4 pl-6 space-y-2 list-disc marker:text-[var(--color-text-muted)]">{children}</ul>,
                ol: ({ children }) => <ol className="mb-4 pl-6 space-y-2 list-decimal marker:text-[var(--color-text-muted)]">{children}</ol>,
                li: ({ children }) => <li className="text-[var(--color-text-body)]">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-[var(--color-text-primary)]">{children}</strong>,
                em: ({ children }) => <em className="italic text-[var(--color-text-body)]">{children}</em>,
                blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-[var(--color-border)] pl-4 italic text-[var(--color-text-muted)] my-4 bg-[var(--color-surface-alt)] py-2 rounded-r-lg">
                        {children}
                    </blockquote>
                ),
                code: ({ node, inline, className, children, ...props }: any) => {
                    const match = /language-(\w+)/.exec(className || '');
                    const isInline = inline || !match;

                    if (isInline) {
                        return (
                            <code className="px-1.5 py-0.5 rounded-md bg-[rgba(0,0,0,0.06)] text-[0.9em] font-mono text-[var(--color-text-primary)]" {...props}>
                                {children}
                            </code>
                        );
                    }

                    const language = match ? match[1] : '';
                    const codeString = String(children).replace(/\n$/, '');

                    return (
                        <div className="relative group my-4 rounded-xl overflow-hidden border border-[var(--color-border)] bg-[#1e1e1e] shadow-sm">
                            <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] text-xs font-mono text-gray-300 border-b border-[#3d3d3d]">
                                <span>{language || 'text'}</span>
                                <CopyButton text={codeString} />
                            </div>
                            <div className="p-4 overflow-x-auto">
                                <code className="text-[13px] leading-relaxed font-mono text-gray-100" {...props}>
                                    {codeString}
                                </code>
                            </div>
                        </div>
                    );
                },
                a: ({ children, href }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline underline-offset-2 transition-colors">
                        {children}
                    </a>
                ),
                table: ({ children }) => (
                    <div className="overflow-x-auto my-6 rounded-lg border border-[var(--color-border)] shadow-sm">
                        <table className="min-w-full divide-y divide-[var(--color-border)] text-sm">
                            {children}
                        </table>
                    </div>
                ),
                thead: ({ children }) => <thead className="bg-[var(--color-surface-alt)]">{children}</thead>,
                tbody: ({ children }) => <tbody className="divide-y divide-[var(--color-border)] bg-transparent">{children}</tbody>,
                tr: ({ children }) => <tr className="hover:bg-[var(--color-surface-alt)]/50 transition-colors">{children}</tr>,
                th: ({ children }) => <th className="px-4 py-3 text-left font-medium text-[var(--color-text-primary)] tracking-wider selection:bg-[var(--color-primary)] selection:text-white">{children}</th>,
                td: ({ children }) => <td className="px-4 py-3 text-[var(--color-text-body)] whitespace-nowrap">{children}</td>,
                hr: () => <hr className="my-6 border-[var(--color-border)]" />
            }}
        >
            {content}
        </ReactMarkdown>
    );
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            className="p-1.5 rounded-md hover:bg-[#3d3d3d] transition-colors text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
            title="Copy code"
            aria-label="Copy code"
        >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
        </button>
    );
}
