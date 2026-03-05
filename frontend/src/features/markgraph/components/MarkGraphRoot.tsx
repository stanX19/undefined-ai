import { useMarkGraphStore } from "../store.ts";
import type { MarkGraphElement, Container, Scene } from "../types.ts";
import { CheckboxBlockView } from "./CheckboxBlockView.tsx";
import { QuizBlockView } from "./QuizBlockView.tsx";
import { InputBlockView } from "./InputBlockView.tsx";
import { ProgressBlockView } from "./ProgressBlockView.tsx";
import { GraphBlockView } from "./GraphBlockView.tsx";
import ReactMarkdown from "react-markdown";

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
    if (element.fragments && element.fragments.length > 0) {
      return (
        <div className="prose prose-sm dark:prose-invert max-w-none text-text-primary">
          {element.fragments.map((frag: any, i: number) => {
            if (typeof frag === "string") {
              return (
                <span key={i}>
                  <ReactMarkdown
                    components={{
                      p: ({ node, ...props }) => <span {...props} />, // Prevent block-level paragraphs inside fragments
                    }}
                  >
                    {frag}
                  </ReactMarkdown>
                </span>
              );
            }
            if (frag.type === "RedirLink") {
              const targetId = frag.target.replace(/^#/, "");
              if (frag.kind === "button") {
                return (
                  <button
                    key={i}
                    onClick={() => useMarkGraphStore.getState().navigateScene(targetId)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors mx-1"
                  >
                    {frag.label} →
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
      <div className="prose prose-sm dark:prose-invert max-w-none text-text-primary">
        <ReactMarkdown
          components={{
            a: ({ node, href, children, ...props }) => {
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
    return <CheckboxBlockView block={element} />;
  }
  if (element.type === "QuizBlock") {
    return <QuizBlockView block={element} />;
  }
  if (element.type === "InputBlock") {
    return <InputBlockView block={element} />;
  }
  if (element.type === "ProgressBlock") {
    return <ProgressBlockView block={element} />;
  }
  if (element.type === "GraphBlock") {
    return <GraphBlockView block={element} />;
  }
  if (element.type === "RedirLink") {
    return (
      <button 
        onClick={() => {
          const targetId = element.target.replace(/^#/, '');
          useMarkGraphStore.getState().navigateScene(targetId);
        }}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors"
      >
        {element.label} →
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

function ContainerRenderer({ container }: { container: Container }) {
  const dir = layoutDirection(container.attrs);
  const isCard = hasCardAttr(container.attrs);
  const headingCls = HEADING_CLASSES[container.depth] || "text-base font-semibold";

  const wrapperCls = isCard
    ? "flex flex-col gap-3 p-4 rounded-xl border border-border/50 bg-surface/80 backdrop-blur-sm shadow-sm"
    : "flex flex-col gap-3";

  return (
    <div className={wrapperCls}>
      {container.raw_heading && (
        <div className={`${headingCls} text-text-primary`}>
          {container.raw_heading}
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
    <section className="flex flex-col gap-5">
      {scene.raw_heading && (
        <h1 className="text-2xl font-bold text-text-primary">
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
  const { ast, sceneId } = useMarkGraphStore();

  if (!ast || !ast.scenes || ast.scenes.length === 0) {
    return null;
  }

  const activeScene = ast.scenes.find(s => s.id === sceneId) || ast.scenes[0];

  return (
    <div className="flex flex-col gap-8 w-full animate-in fade-in duration-300">
      <SceneRenderer key={activeScene.id} scene={activeScene} />
    </div>
  );
}
