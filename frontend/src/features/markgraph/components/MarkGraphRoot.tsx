import { useRef, useState } from "react";
import { useMarkGraphStore } from "../store.ts";
import type {
  MarkGraphElement,
  Container,
  Scene,
  CheckboxBlock,
  QuizBlock,
  InputBlock,
  ProgressBlock,
  GraphBlock,
  RedirLink,
  Include,
  TextNode,
} from "../types.ts";
import { CheckboxBlockView } from "./CheckboxBlockView.tsx";
import { QuizBlockView } from "./QuizBlockView.tsx";
import { InputBlockView } from "./InputBlockView.tsx";
import { ProgressBlockView } from "./ProgressBlockView.tsx";
import { GraphBlockView } from "./GraphBlockView.tsx";
import ReactMarkdown from "react-markdown";

const GAP = 12;

type ASTNode = Scene | Container | MarkGraphElement;

/** Returns true if the container has @row attribute. */
function hasAttr(node: ASTNode, name: string): boolean {
  if ("attrs" in node && Array.isArray(node.attrs)) {
    return node.attrs.some((a) => a.name === name);
  }
  return false;
}

// ─── Card wrapper — draggable + resizable ────────────────────────────────

function DraggableCard({
  children,
  className = "",
  style = {},
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const offsetRef = useRef({ dx: 0, dy: 0 });
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dragSize, setDragSize] = useState<{ w: number; h: number } | null>(null);
  const resizingRef = useRef(false);
  const resizeStartRef = useRef({ mx: 0, my: 0, w: 0, h: 0 });

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const tag = (e.target as HTMLElement).tagName;
    if (["INPUT", "TEXTAREA", "BUTTON", "SELECT", "LABEL", "A"].includes(tag)) return;

    // Only drag from this card itself (not child cards)
    const el = e.currentTarget as HTMLElement;
    const targetCard = (e.target as HTMLElement).closest("[data-mg-card]");
    if (targetCard && targetCard !== el) return;

    e.stopPropagation();
    el.setPointerCapture(e.pointerId);
    draggingRef.current = true;

    const rect = el.getBoundingClientRect();
    offsetRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    e.preventDefault();
    const parent = (e.currentTarget as HTMLElement).offsetParent as HTMLElement | null;
    const parentRect = parent?.getBoundingClientRect() ?? { left: 0, top: 0 };
    setDragPos({
      x: e.clientX - parentRect.left - offsetRef.current.dx,
      y: e.clientY - parentRect.top - offsetRef.current.dy,
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const onResizeDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    resizingRef.current = true;
    const el = elRef.current;
    resizeStartRef.current = {
      mx: e.clientX,
      my: e.clientY,
      w: el?.offsetWidth ?? 200,
      h: el?.offsetHeight ?? 100,
    };
  };

  const onResizeMove = (e: React.PointerEvent) => {
    if (!resizingRef.current) return;
    e.preventDefault();
    setDragSize({
      w: Math.max(120, resizeStartRef.current.w + (e.clientX - resizeStartRef.current.mx)),
      h: Math.max(60, resizeStartRef.current.h + (e.clientY - resizeStartRef.current.my)),
    });
  };

  const onResizeUp = (e: React.PointerEvent) => {
    if (!resizingRef.current) return;
    resizingRef.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const posStyle: React.CSSProperties = dragPos
    ? { position: "absolute", left: dragPos.x, top: dragPos.y, zIndex: 50 }
    : {};

  const sizeStyle: React.CSSProperties = dragSize
    ? { width: dragSize.w, minHeight: dragSize.h }
    : {};

  return (
    <div
      ref={elRef}
      data-mg-card
      className={`relative group ${className}`}
      style={{ cursor: "grab", ...style, ...posStyle, ...sizeStyle }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {children}

      {/* SE resize handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-0 group-hover:opacity-50 transition-opacity z-10"
        style={{
          background: "linear-gradient(135deg, transparent 50%, var(--ds-border) 50%)",
          borderRadius: "0 0 8px 0",
        }}
        onPointerDown={onResizeDown}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
      />
    </div>
  );
}

// ─── Main MarkGraphRoot ─────────────────────────────────────────────────

export function MarkGraphRoot() {
  const { ast } = useMarkGraphStore();

  if (!ast?.scenes?.length) return null;

  return (
    <div className="w-full flex flex-col gap-4">
      {ast.scenes.map((scene, i) => (
        <SceneRenderer key={scene.id || `scene-${i}`} scene={scene} />
      ))}
    </div>
  );
}

// ─── Scene Renderer ─────────────────────────────────────────────────────

function SceneRenderer({ scene }: { scene: Scene }) {
  const isRowLayout = hasAttr(scene, "row");

  return (
    <DraggableCard
      className="rounded-xl border border-border/40 bg-surface/70 backdrop-blur-sm shadow-level1 overflow-hidden"
    >
      {/* Scene heading */}
      {scene.raw_heading && (
        <div className="px-5 pt-4 pb-3 border-b border-border/30">
          <h2 className="text-lg font-bold text-text-primary">
            {scene.raw_heading}
          </h2>
        </div>
      )}

      {/* Scene children */}
      <div
        className="p-4"
        style={{
          display: "flex",
          flexDirection: isRowLayout ? "row" : "column",
          gap: GAP,
          flexWrap: isRowLayout ? "wrap" : "nowrap",
        }}
      >
        {scene.children.map((child, i) => (
          <ChildRenderer key={childKey(child, i)} node={child} parentIsRow={isRowLayout} />
        ))}
      </div>
    </DraggableCard>
  );
}

// ─── Child Renderer (recursive) ──────────────────────────────────────────

function ChildRenderer({
  node,
  parentIsRow,
}: {
  node: ASTNode;
  parentIsRow: boolean;
}) {
  const isContainer = node.type === "Container";
  const hasChildren =
    isContainer &&
    "children" in node &&
    Array.isArray(node.children) &&
    node.children.length > 0;

  if (isContainer && hasChildren) {
    return (
      <ContainerRenderer
        container={node as Container}
        flex={parentIsRow ? 1 : undefined}
      />
    );
  }

  // Leaf element
  return (
    <DraggableCard
      className="rounded-lg border border-border/30 bg-white/80 p-3 backdrop-blur-sm hover:shadow-level1 transition-shadow"
      style={{ flex: parentIsRow ? 1 : undefined, minWidth: parentIsRow ? 100 : undefined }}
    >
      <ElementRenderer element={node} />
    </DraggableCard>
  );
}

// ─── Container Renderer ─────────────────────────────────────────────────

function ContainerRenderer({
  container,
  flex,
}: {
  container: Container;
  flex?: number;
}) {
  const isRowLayout = hasAttr(container, "row");
  const isCard = hasAttr(container, "card");

  // Visual depth styling
  const depthColors = [
    "bg-surface/50",       // depth 2
    "bg-surface/40",       // depth 3
    "bg-surface/30",       // depth 4
    "bg-surface/20",       // depth 5+
  ];
  const bgClass = depthColors[Math.min(container.depth - 2, depthColors.length - 1)] ?? "bg-surface/40";

  return (
    <DraggableCard
      className={`rounded-lg border border-border/30 ${bgClass} backdrop-blur-sm overflow-hidden ${isCard ? "shadow-level1" : ""}`}
      style={{ flex, minWidth: flex ? 100 : undefined }}
    >
      {/* Container heading */}
      {container.raw_heading && (
        <div className="px-4 pt-3 pb-2 border-b border-border/20">
          <h3
            className="font-semibold text-text-primary uppercase tracking-wide"
            style={{ fontSize: Math.max(11, 15 - container.depth) }}
          >
            {container.raw_heading}
          </h3>
        </div>
      )}

      {/* Container children */}
      <div
        className="p-3"
        style={{
          display: "flex",
          flexDirection: isRowLayout ? "row" : "column",
          gap: GAP,
          flexWrap: isRowLayout ? "wrap" : "nowrap",
        }}
      >
        {container.children.map((child, i) => (
          <ChildRenderer
            key={childKey(child, i)}
            node={child}
            parentIsRow={isRowLayout}
          />
        ))}
      </div>
    </DraggableCard>
  );
}

// ─── Element Renderer ───────────────────────────────────────────────────

function ElementRenderer({ element }: { element: ASTNode }) {
  if (element.type === "Container" || element.type === "Scene") {
    const heading = (element as Scene | Container).raw_heading;
    return heading ? (
      <h3 className="text-sm font-semibold text-text-primary">{heading}</h3>
    ) : null;
  }
  if (element.type === "TextNode") {
    return (
      <div className="text-sm prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        <ReactMarkdown>{(element as TextNode).markdown}</ReactMarkdown>
      </div>
    );
  }
  if (element.type === "CheckboxBlock") {
    return <CheckboxBlockView block={element as CheckboxBlock} />;
  }
  if (element.type === "QuizBlock") {
    return <QuizBlockView block={element as QuizBlock} />;
  }
  if (element.type === "InputBlock") {
    return <InputBlockView block={element as InputBlock} />;
  }
  if (element.type === "ProgressBlock") {
    return <ProgressBlockView block={element as ProgressBlock} />;
  }
  if (element.type === "GraphBlock") {
    return <GraphBlockView block={element as GraphBlock} />;
  }
  if (element.type === "RedirLink" || element.type === "Include") {
    const el = element as RedirLink | Include;
    return (
      <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-md inline-block">
        {el.label} {"→"} {el.target}
      </span>
    );
  }
  return <div className="text-xs text-red-500">Unknown: {(element as any).type}</div>;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function childKey(node: ASTNode, index: number): string {
  if ("id" in node && node.id) return node.id;
  if ("explicit_id" in node && node.explicit_id) return node.explicit_id;
  return `_i${index}`;
}
