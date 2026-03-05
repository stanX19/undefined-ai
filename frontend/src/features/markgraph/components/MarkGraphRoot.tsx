import { useState, useRef, useEffect } from "react";
import { useMarkGraphStore } from "../store.ts";
import type { MarkGraphElement, Container, Scene } from "../types.ts";
import { useForceLayout } from "../hooks/useForceLayout.ts";
import { CheckboxBlockView } from "./CheckboxBlockView.tsx";
import { QuizBlockView } from "./QuizBlockView.tsx";
import { InputBlockView } from "./InputBlockView.tsx";
import { ProgressBlockView } from "./ProgressBlockView.tsx";
import { GraphBlockView } from "./GraphBlockView.tsx";
import ReactMarkdown from "react-markdown";

type MGNode = Scene | Container | MarkGraphElement;

// Helper to flatten the AST tree into nodes and implicit edges (parent-child)
function flattenAST(root: Scene) {
  const nodes: MGNode[] = [];
  const edges: { source: string; target: string }[] = [];

  function traverse(node: MGNode, parentId?: string) {
    if (!node) return;
    
    // Auto-generate standard IDs for elements without explicit_id
    const id = (node as any).id || (node as any).explicit_id || Math.random().toString(36).substr(2, 9);
    (node as any)._uid = id;
    
    nodes.push(node);
    
    if (parentId) {
      edges.push({ source: parentId, target: id });
    }

    if ("children" in node && Array.isArray(node.children)) {
      node.children.forEach(child => traverse(child, id));
    }
  }

  traverse(root);
  return { nodes, edges };
}

export function MarkGraphRoot() {
  const { ast } = useMarkGraphStore();
  const [size, setSize] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      setSize({
        width: containerRef.current?.clientWidth || 800,
        height: containerRef.current?.clientHeight || 600,
      });
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  if (!ast || !ast.scenes || ast.scenes.length === 0) {
    return null;
  }

  // Right now MarkGraph shows only the first scene. Multi-scene navigation can be added later.
  const rootScene = ast.scenes[0];
  const { nodes, edges } = flattenAST(rootScene);

  // Convert to layout nodes
  const layoutNodes = nodes.map(n => ({
    id: (n as any)._uid,
    type: n.type,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    width: 250, // rough estimate
    height: 100, // rough estimate
    data: n,
  }));

  const positions = useForceLayout(layoutNodes, edges, size.width, size.height);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-bg rounded-lg border border-border">
      {/* Draw edges (optional, skipped for now to keep it clean, can uncomment to see family tree) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20 hidden">
         {edges.map((e, i) => {
             const p1 = positions[e.source];
             const p2 = positions[e.target];
             if (!p1 || !p2) return null;
             return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="var(--color-border)" strokeWidth="2" />
         })}
      </svg>
      
      {/* Draw nodes */}
      {layoutNodes.map((node) => {
        const pos = positions[node.id];
        if (!pos) return null;

        return (
          <div
            key={node.id}
            className="absolute p-4 flex flex-col gap-2 rounded-xl border border-border/50 bg-surface/80 backdrop-blur-md shadow-sm transition-opacity duration-300"
            style={{
              width: node.width,
              left: pos.x - node.width / 2,
              top: pos.y - node.height / 2,
            }}
          >
            <ElementRenderer element={node.data} />
          </div>
        );
      })}
    </div>
  );
}

function ElementRenderer({ element }: { element: any }) {
  if (element.type === "Scene" || element.type === "Container") {
    return <h2 className="text-lg font-bold text-text-primary border-b border-border pb-2">{element.raw_heading}</h2>;
  }
  if (element.type === "TextNode") {
    return <div className="text-sm prose prose-sm dark:prose-invert"><ReactMarkdown>{element.markdown}</ReactMarkdown></div>;
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
  if (element.type === "RedirLink" || element.type === "Include") {
    return <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-md">{element.label} {"->"} {element.target}</span>;
  }
  return <div className="text-xs text-red-500">Unknown type: {element.type}</div>;
}
