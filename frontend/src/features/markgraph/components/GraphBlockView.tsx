import { ReactFlow, Background, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GraphBlock } from "../types.ts";
import { useForceLayout } from "../hooks/useForceLayout.ts";
import type { NodeData, EdgeData } from "../hooks/useForceLayout.ts";
import { useMarkGraphStore } from "../store.ts";

export function GraphBlockView({ block }: { block: GraphBlock }) {
  const initialNodes: NodeData[] = block.vertices.map((v) => ({
    id: v.id,
    type: "default",
    x: 0,
    y: 0,
    width: 150, // width used for collision detection
    height: 40, // height used for collision detection
    data: { label: v.display, nav_target: v.nav_target },
  }));

  const initialEdges: EdgeData[] = block.edges.map((e) => ({
    source: e.src,
    target: e.dst,
  }));

  const { nodes: animatedNodes, onNodeDragStart, onNodeDrag, onNodeDragStop } = useForceLayout(
    initialNodes,
    initialEdges,
    600,
    300
  );

  // Map D3 animated nodes back to React Flow format
  const reactFlowNodes = animatedNodes.map((n) => ({
    id: n.id,
    position: { x: n.x, y: n.y },
    data: n.data,
    type: "default",
  }));

  const edges = block.edges.map((e, i) => {
    let style = {};
    if (e.op === "--") style = { strokeDasharray: "5 5" };
    
    return {
      id: `e-${e.src}-${e.dst}-${i}`,
      source: e.src,
      target: e.dst,
      animated: e.op === "->",
      type: "straight",
      style,
    };
  });

  const onNodeClick = (_: any, node: any) => {
    const target = node.data.nav_target;
    if (target) {
      const targetId = target.replace(/^#/, '');
      useMarkGraphStore.getState().navigateScene(targetId);
    }
  };

  return (
    <div className="w-full h-[400px] border border-border rounded-lg overflow-hidden bg-surface">
      <ReactFlow 
        nodes={reactFlowNodes} 
        edges={edges} 
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        fitView 
        minZoom={0.5} 
        maxZoom={2}
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
