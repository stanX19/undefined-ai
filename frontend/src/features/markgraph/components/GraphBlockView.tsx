import { ReactFlow, Background, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GraphBlock } from "../types.ts";

export function GraphBlockView({ block }: { block: GraphBlock }) {
  // Simple deterministic initial layout, ReactFlow supports dragging automatically
  const nodes = block.vertices.map((v, i) => ({
    id: v.id,
    position: { x: 50 + (i % 3) * 150, y: 50 + Math.floor(i / 3) * 100 },
    data: { label: v.display },
    type: "default",
  }));

  const edges = block.edges.map((e, i) => {
    let style = {};
    if (e.op === "--") style = { strokeDasharray: "5 5" }; // Just a visual diff
    
    return {
      id: `e-${e.src}-${e.dst}-${i}`,
      source: e.src,
      target: e.dst,
      animated: e.op === "->",
      type: "straight",
      style,
    };
  });

  return (
    <div className="w-full h-[300px] border border-border rounded-lg overflow-hidden bg-surface">
      <ReactFlow nodes={nodes} edges={edges} fitView minZoom={0.5} maxZoom={2}>
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
