import { useEffect, useMemo } from "react";
import { ReactFlow, Controls, Handle, Position, useNodesState, useEdgesState } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GraphBlock } from "../types.ts";
import { useForceLayout } from "../hooks/useForceLayout.ts";
import type { NodeData, EdgeData } from "../hooks/useForceLayout.ts";
import { useMarkGraphStore } from "../store.ts";

function NeoNode({ data }: any) {
  return (
    <div className="flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 rounded-full border-4 border-blue-500/20 shadow-lg cursor-pointer hover:ring-2 hover:ring-blue-500/50 transition-all font-bold text-[10px] text-center px-1 leading-tight overflow-hidden break-all">
      <span className="line-clamp-3">{data.label}</span>
      <Handle type="source" position={Position.Bottom} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} className="opacity-0 w-0 h-0" />
      <Handle type="target" position={Position.Top} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} className="opacity-0 w-0 h-0" />
    </div>
  );
}

const nodeTypes = {
  neo: NeoNode,
};

export function GraphBlockView({ block }: { block: GraphBlock }) {
  const initialNodes: NodeData[] = useMemo(() => block.vertices.map((v) => ({
    id: v.id,
    type: "neo",
    x: 0,
    y: 0,
    width: 64, // width matching w-16
    height: 64, // height matching h-16
    data: { label: v.display, nav_target: v.nav_target },
  })), [block.vertices]);

  const initialEdges: EdgeData[] = useMemo(() => block.edges.map((e) => ({
    source: e.src,
    target: e.dst,
  })), [block.edges]);

  const { nodes: animatedNodes, onNodeDragStart, onNodeDrag, onNodeDragStop } = useForceLayout(
    initialNodes,
    initialEdges,
    600,
    300
  );

  // Map D3 animated nodes back to React Flow format
  const reactFlowNodes = useMemo(() => animatedNodes.map((n) => ({
    id: n.id,
    position: { x: n.x ?? 0, y: n.y ?? 0 },
    data: n.data,
    type: "neo",
  })), [animatedNodes]);

  const initialReactEdges = useMemo(() => block.edges.map((e, i) => {
    let style: any = { strokeWidth: 3 };
    if (e.op === "--") style.strokeDasharray = "5 5";
    
    return {
      id: `e-${e.src}-${e.dst}-${i}`,
      source: e.src,
      target: e.dst,
      animated: e.op === "->",
      type: "straight",
      style,
    };
  }), [block.edges]);
  
  const [nodes, setNodes, onNodesChange] = useNodesState<any>(reactFlowNodes);
  const [edgesState, setEdges, onEdgesChange] = useEdgesState<any>(initialReactEdges);

  // Sync d3-force positions to React Flow nodes
  useEffect(() => {
    setNodes((nds) => {
      // If React Flow nodes are completely uninitialized, populate them entirely.
      if (nds.length === 0 && reactFlowNodes.length > 0) {
        return reactFlowNodes;
      }
      let changed = false;
      const newNds = nds.map((node) => {
        const d3Node = animatedNodes.find((an) => an.id === node.id);
        if (d3Node) {
          const newX = d3Node.x ?? 0;
          const newY = d3Node.y ?? 0;
          if (node.position.x !== newX || node.position.y !== newY) {
            changed = true;
            return { ...node, position: { x: newX, y: newY } };
          }
        }
        return node;
      });
      return changed ? newNds : nds;
    });
    // We only update edges if they haven't been loaded yet, since they are static
    setEdges((eds) => eds.length === 0 ? initialReactEdges : eds);
  }, [animatedNodes, reactFlowNodes, initialReactEdges, setNodes, setEdges]);

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
        nodes={nodes} 
        edges={edgesState}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        fitView 
        minZoom={0.5} 
        maxZoom={2}
      >
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
