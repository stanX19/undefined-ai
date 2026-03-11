import React, { useEffect } from "react";
import { Copy, Check } from "lucide-react";
import { useMarkGraphStore } from "../store.ts";
import type { MarkGraphElement, Container, Scene } from "../types.ts";
import { CheckboxBlockView } from "./CheckboxBlockView.tsx";
import { QuizBlockView } from "./QuizBlockView.tsx";
import { InputBlockView } from "./InputBlockView.tsx";
import { ProgressBlockView } from "./ProgressBlockView.tsx";
import { GraphBlockView } from "./GraphBlockView.tsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

/* ── markdown copy button ────────────────────────────────────────────────── */

function CodeCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-1.5 rounded-md hover:bg-[#3d3d3d] transition-colors text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
      title="Copy code"
      aria-label="Copy code"
    >
      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
    </button>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

/** Return the flex-direction hint from container attrs (@row / @column). */
function layoutDirection(attrs: { name: string }[]): "row" | "column" {
  for (const a of attrs) {
    if (a.name === "row") return "row";
    if (a.name === "column") return "column";
  }
  return "column"; // default
}

/** Check if attr list contains a "card" hint (:::card containers). */
function hasCardAttr(attrs: { name: string }[]): boolean {
  return attrs.some((a) => a.name === "card");
}

/* ── element renderer ────────────────────────────────────────────────────── */

function ElementRenderer({ element }: { element: MarkGraphElement }) {
    if (element.type === "TextNode") {
    // Render Fragments directly instead of passing the raw string to ReactMarkdown.
    // This allows custom syntaxes like [[Button]](#target) which the python parser
    // extracted into RedirLink objects to be rendered properly.
    const markdownComponents = {
      h1: ({ children }: { children?: React.ReactNode }) => <h1 className="text-2xl sm:text-3xl font-bold text-[#1a1a1a] mt-8 mb-4 tracking-tight leading-tight">{children}</h1>,
      h2: ({ children }: { children?: React.ReactNode }) => <h2 className="text-xl sm:text-2xl font-semibold text-[#1a1a1a] mt-6 mb-3 tracking-tight">{children}</h2>,
      h3: ({ children }: { children?: React.ReactNode }) => <h3 className="text-lg font-semibold text-[#262626] mt-5 mb-2">{children}</h3>,
      p: ({ children }: { children?: React.ReactNode }) => <p className="text-[15px] leading-[1.7] text-[#374151] mb-4 last:mb-0">{children}</p>,
      strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-[#1a1a1a]">{children}</strong>,
      em: ({ children }: { children?: React.ReactNode }) => <em className="italic text-text-primary">{children}</em>,
      ul: ({ children }: { children?: React.ReactNode }) => <ul className="mb-4 pl-6 space-y-3 list-disc marker:text-text-muted [&_ul]:mt-3 [&_ol]:mt-3">{children}</ul>,
      ol: ({ children }: { children?: React.ReactNode }) => <ol className="mb-4 pl-6 space-y-3 list-decimal marker:text-text-muted [&_ul]:mt-3 [&_ol]:mt-3">{children}</ol>,
      li: ({ children }: { children?: React.ReactNode }) => <li className="text-[#374151] leading-relaxed [&>ul]:mt-3 [&>ol]:mt-3">{children}</li>,
      blockquote: ({ children }: { children?: React.ReactNode }) => (
        <blockquote className="border-l-4 border-border pl-4 italic text-text-muted my-4 bg-surface/50 py-2 rounded-r-lg">
          {children}
        </blockquote>
      ),
      hr: () => <hr className="my-6 border-border" />,
      code: ({ node: _node, inline, className, children, ...props }: { node?: unknown; inline?: boolean; className?: string; children?: React.ReactNode }) => {
        const match = /language-(\w+)/.exec(className || "");
        const isInline = inline ?? !match;
        if (isInline) {
          return (
            <code className="px-1.5 py-0.5 rounded-md bg-gray-100 text-[0.9em] font-mono text-text-primary" {...props}>
              {children}
            </code>
          );
        }
        const language = match ? match[1] : "";
        const codeString = String(children).replace(/\n$/, "");
        return (
          <div className="relative my-4 rounded-xl overflow-hidden border border-border bg-[#1e1e1e] shadow-sm">
            <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] text-xs font-mono text-gray-300 border-b border-[#3d3d3d]">
              <span>{language || "text"}</span>
              <CodeCopyButton text={codeString} />
            </div>
            <div className="p-4 overflow-x-auto">
              <code className="text-[13px] leading-relaxed font-mono text-gray-100" {...props}>
                {codeString}
              </code>
            </div>
          </div>
        );
      },
      table: ({ node: _node, ...props }: Record<string, unknown>) => (
        <div className="overflow-x-auto my-4 w-full rounded-lg border border-gray-200">
          <table className="w-full text-left border-collapse my-0" {...props} />
        </div>
      ),
      thead: ({ children }: { children?: React.ReactNode }) => <thead className="bg-gray-50">{children}</thead>,
      tbody: ({ children }: { children?: React.ReactNode }) => <tbody className="divide-y divide-gray-100">{children}</tbody>,
      tr: ({ children }: { children?: React.ReactNode }) => <tr>{children}</tr>,
      th: ({ node: _node, ...props }: Record<string, unknown>) => <th className="bg-gray-50 border-b-2 border-gray-200 px-4 py-3 font-semibold text-sm text-[#1a1a1a]" {...props} />,
      td: ({ node: _node, ...props }: Record<string, unknown>) => <td className="bg-white border-b border-gray-100 px-4 py-3 text-sm text-[#374151]" {...props} />,
    };

    if (element.fragments && element.fragments.length > 0) {
      return (
        <div id={element.explicit_id || undefined} className="prose prose-sm dark:prose-invert max-w-none text-text-primary">
          {element.fragments.map((frag: any, i: number) => {
            if (typeof frag === "string") {
              return (
                <React.Fragment key={i}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      h1: markdownComponents.h1 as React.ComponentType<any>,
                      h2: markdownComponents.h2 as React.ComponentType<any>,
                      h3: markdownComponents.h3 as React.ComponentType<any>,
                      p: markdownComponents.p as React.ComponentType<any>,
                      strong: markdownComponents.strong as React.ComponentType<any>,
                      em: markdownComponents.em as React.ComponentType<any>,
                      ul: markdownComponents.ul as React.ComponentType<any>,
                      ol: markdownComponents.ol as React.ComponentType<any>,
                      li: markdownComponents.li as React.ComponentType<any>,
                      blockquote: markdownComponents.blockquote as React.ComponentType<any>,
                      hr: markdownComponents.hr as React.ComponentType<any>,
                      code: markdownComponents.code as React.ComponentType<any>,
                      table: markdownComponents.table as React.ComponentType<any>,
                      thead: markdownComponents.thead as React.ComponentType<any>,
                      tbody: markdownComponents.tbody as React.ComponentType<any>,
                      tr: markdownComponents.tr as React.ComponentType<any>,
                      th: markdownComponents.th as React.ComponentType<any>,
                      td: markdownComponents.td as React.ComponentType<any>,
                    }}
                  >
                    {frag}
                  </ReactMarkdown>
                </React.Fragment>
              );
            }
            if (frag.type === "RedirLink") {
              const targetId = frag.target.replace(/^#/, "");
              if (frag.kind === "button") {
                return (
                  <button
                    key={i}
                    onClick={() => useMarkGraphStore.getState().navigateScene(targetId)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-[14px] font-semibold text-[#1a1a1a] bg-gray-100 hover:bg-gray-200 border border-gray-200/80 rounded-xl transition-all duration-200 hover:shadow-sm hover:border-gray-300 active:scale-[0.98] mt-2 mr-3"
                  >
                    {frag.label}
                    <span className="text-gray-500">→</span>
                  </button>
                );
              } else {
                return (
                  <a
                    key={i}
                    href={frag.target}
                    onClick={(e) => {
                      e.preventDefault();
                      useMarkGraphStore.getState().navigateScene(targetId);
                    }}
                    className="text-primary hover:underline mx-1 cursor-pointer"
                  >
                    {frag.label}
                  </a>
                );
              }
            }
            if (frag.type === "Include") {
              return (
                <span key={i} className="text-xs italic text-text-muted mx-1">
                  [include: {frag.target}]
                </span>
              );
            }
            return null;
          })}
        </div>
      );
    }

    // Fallback if there are no fragments (older ASTs)
    return (
      <div id={element.explicit_id || undefined} className="prose prose-sm dark:prose-invert max-w-none text-text-primary">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            h1: markdownComponents.h1 as React.ComponentType<any>,
            h2: markdownComponents.h2 as React.ComponentType<any>,
            h3: markdownComponents.h3 as React.ComponentType<any>,
            p: markdownComponents.p as React.ComponentType<any>,
            strong: markdownComponents.strong as React.ComponentType<any>,
            em: markdownComponents.em as React.ComponentType<any>,
            ul: markdownComponents.ul as React.ComponentType<any>,
            ol: markdownComponents.ol as React.ComponentType<any>,
            li: markdownComponents.li as React.ComponentType<any>,
            blockquote: markdownComponents.blockquote as React.ComponentType<any>,
            hr: markdownComponents.hr as React.ComponentType<any>,
            code: markdownComponents.code as React.ComponentType<any>,
            table: markdownComponents.table as React.ComponentType<any>,
            thead: markdownComponents.thead as React.ComponentType<any>,
            tbody: markdownComponents.tbody as React.ComponentType<any>,
            tr: markdownComponents.tr as React.ComponentType<any>,
            th: markdownComponents.th as React.ComponentType<any>,
            td: markdownComponents.td as React.ComponentType<any>,
            a: ({ node: _node, href, children, ...props }) => {
              if (href?.startsWith("#")) {
                return (
                  <a
                    href={href}
                    {...props}
                    onClick={(e) => {
                      e.preventDefault();
                      const targetId = href.replace(/^#/, "");
                      useMarkGraphStore.getState().navigateScene(targetId);
                    }}
                  >
                    {children}
                  </a>
                );
              }
              return (
                <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                  {children}
                </a>
              );
            },
          }}
        >
          {element.markdown}
        </ReactMarkdown>
      </div>
    );
  }
  if (element.type === "CheckboxBlock") {
    return <CheckboxBlockView id={element.explicit_id || undefined} block={element} />;
  }
  if (element.type === "QuizBlock") {
    return <QuizBlockView id={element.explicit_id || undefined} block={element} />;
  }
  if (element.type === "InputBlock") {
    return <InputBlockView id={element.explicit_id || undefined} block={element} />;
  }
  if (element.type === "ProgressBlock") {
    return <ProgressBlockView id={element.explicit_id || undefined} block={element} />;
  }
  if (element.type === "GraphBlock") {
    return <GraphBlockView block={element} />;
  }
  if (element.type === "RedirLink") {
    return (
      <button 
        id={element.target?.replace(/^#/, '') + '-btn'}
        onClick={() => {
          const targetId = element.target.replace(/^#/, '');
          useMarkGraphStore.getState().navigateScene(targetId);
        }}
        className="inline-flex items-center gap-2 px-4 py-2.5 text-[14px] font-semibold text-[#1a1a1a] bg-gray-100 hover:bg-gray-200 border border-gray-200/80 rounded-xl transition-all duration-200 hover:shadow-sm hover:border-gray-300 active:scale-[0.98] mr-3"
      >
        {element.label}
        <span className="text-gray-500">→</span>
      </button>
    );
  }
  if (element.type === "Include") {
    return (
      <span className="text-xs italic text-text-muted">
        [include: {element.target}]
      </span>
    );
  }
  return null;
}

/* ── container / scene renderer ──────────────────────────────────────────── */

/** Map heading depth (2-6) to a Tailwind text class. */
const HEADING_CLASSES: Record<number, string> = {
  2: "text-xl font-bold",
  3: "text-lg font-semibold",
  4: "text-base font-semibold",
  5: "text-sm font-semibold",
  6: "text-sm font-medium",
};

function formatContainerHeading(raw: string): string {
  const m = raw.match(/^q(\d+)$/i);
  return m ? `Question ${m[1]}` : raw;
}

function ContainerRenderer({ container }: { container: Container }) {
  const dir = layoutDirection(container.attrs);
  const isCard = hasCardAttr(container.attrs);
  const headingCls = HEADING_CLASSES[container.depth] || "text-base font-semibold";

  const wrapperCls = isCard
    ? "flex flex-col gap-3 p-4 rounded-xl border border-border/50 bg-surface/80 backdrop-blur-sm shadow-sm"
    : "flex flex-col gap-3";

  return (
    <div id={container.id} className={wrapperCls}>
      {container.raw_heading && (
        <div className={`${headingCls} text-text-primary`}>
          {formatContainerHeading(container.raw_heading)}
        </div>
      )}
      <div
        className={`flex gap-4 ${dir === "row" ? "flex-row flex-wrap" : "flex-col"}`}
      >
        {container.children.map((child, i) => (
          <ChildRenderer key={i} node={child} />
        ))}
      </div>
    </div>
  );
}

function SceneRenderer({ scene }: { scene: Scene }) {
  return (
    <section id={scene.id} className="flex flex-col gap-5">
      {scene.raw_heading && (
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1a1a1a] tracking-tight leading-tight">
          {scene.raw_heading}
        </h1>
      )}
      <div className="flex flex-col gap-4">
        {scene.children.map((child, i) => (
          <ChildRenderer key={i} node={child} />
        ))}
      </div>
    </section>
  );
}

/** Recursively dispatch to the right renderer based on node type. */
function ChildRenderer({ node }: { node: Container | MarkGraphElement }) {
  if (!node) return null;

  if (node.type === "Container") {
    return <ContainerRenderer container={node as Container} />;
  }

  // All leaf element types
  return <ElementRenderer element={node as MarkGraphElement} />;
}

/* ── root ─────────────────────────────────────────────────────────────────── */

export function MarkGraphRoot() {
  const { ast, sceneId, scrollTarget, history, goBack } = useMarkGraphStore();

  // Handle scrolling when scrollTarget changes
  useEffect(() => {
    if (scrollTarget) {
      // Use a small timeout to ensure the scene has rendered if it just changed
      const timer = setTimeout(() => {
        const el = document.getElementById(scrollTarget.id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [scrollTarget]);

  if (!ast || !ast.scenes || ast.scenes.length === 0) {
    return null;
  }

  const activeScene = ast.scenes.find(s => s.id === sceneId) || ast.scenes[0];

  return (
    <div className="flex flex-col gap-8 w-full animate-in fade-in duration-300 pb-20">
      {history.length > 0 && (
        <button
          onClick={() => goBack()}
          className="flex items-center gap-1.5 self-start px-2 py-1 text-xs font-semibold text-text-secondary hover:text-primary transition-colors cursor-pointer"
          title="Go back"
        >
          <span>←</span> Back
        </button>
      )}
      <SceneRenderer key={activeScene.id} scene={activeScene} />
    </div>
  );
}
