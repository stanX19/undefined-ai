import { useEffect, useMemo, useRef } from "react";
import { 
  ReactFlow, 
  Controls, 
  Handle, 
  Position, 
  useNodesState, 
  useEdgesState, 
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
  Panel,
  Background,
  BackgroundVariant
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GraphBlock } from "../types.ts";
import { useForceLayout } from "../hooks/useForceLayout.ts";
import type { NodeData, EdgeData } from "../hooks/useForceLayout.ts";
import { useMarkGraphStore } from "../store.ts";

function NeoNode({ data, id }: any) {
  const isClickable = !!data.nav_target;
  // If the explicit label (display text) is different from the ID, 
  // we show the ID in parentheses as context if it fits.
  const displayLabel = data.label === id ? id : `(${id}) ${data.label}`;
  
  return (
    <div 
      title={displayLabel} 
      className={`
        flex items-center justify-center min-w-[120px] max-w-[200px] min-h-[60px] p-3 rounded-2xl border-4 shadow-lg transition-all font-bold text-xs text-center leading-snug
        bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 
        ${isClickable 
          ? "border-blue-500/20 cursor-pointer hover:ring-2 hover:ring-blue-500/50" 
          : "border-blue-100/20"
        }
      `}
    >
      <span>{displayLabel}</span>
      <Handle type="source" position={Position.Bottom} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} className="opacity-0 w-0 h-0" />
      <Handle type="target" position={Position.Top} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} className="opacity-0 w-0 h-0" />
    </div>
  );
}

const nodeTypes = {
  neo: NeoNode,
};

/** 
 * Internal component that processes the actual ReactFlow logic. 
 * This MUST be nested inside <ReactFlowProvider> so useReactFlow hooks work.
 */
function GraphInner({ 
  nodes, 
  edgesState, 
  onNodesChange, 
  onEdgesChange, 
  onNodeDragStart, 
  onNodeDrag, 
  onNodeDragStop, 
  onNodeClick,
  simulationAlpha 
}: any) {
  const { fitView, getNodes } = useReactFlow();
  const hasInitialFit = useRef(false);

  // Auto-fit when d3-force settles for the first time
  useEffect(() => {
    if (!hasInitialFit.current && simulationAlpha < 0.1 && nodes.length > 0) {
      fitView({ duration: 800, padding: 0.2 });
      hasInitialFit.current = true;
    }
  }, [simulationAlpha, nodes.length, fitView]);

  return (
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
      fitViewOptions={{ padding: 0.2, maxZoom: 1.5 }}
      minZoom={0.2} 
      maxZoom={2}
      onMoveEnd={(_, viewport) => {
         // Lost Prevention: Check if any nodes are even remotely visible
         const currentNodes = getNodes();
         if (currentNodes.length === 0) return;

         const margin = 150;
         const containerHeight = 560;
         const containerWidth = 800;
         const isAnyNodeVisible = currentNodes.some(node => {
            const x = (node.position.x * viewport.zoom) + viewport.x;
            const y = (node.position.y * viewport.zoom) + viewport.y;
            return (
              x > -margin && x < containerWidth + margin &&
              y > -margin && y < containerHeight + margin
            );
         });

         if (!isAnyNodeVisible) {
           fitView({ duration: 1000, padding: 0.2 });
         }
      }}
    >
      <Controls showInteractive={false} />
      <Background variant={BackgroundVariant.Dots} />
      <Panel position="top-right">
        <button 
          onClick={() => fitView({ duration: 400, padding: 0.2 })}
          className="bg-background/80 hover:bg-background border border-border px-2 py-1 rounded shadow-sm text-[10px] font-bold transition-all active:scale-95"
        >
          Re-center
        </button>
      </Panel>
    </ReactFlow>
  );
}

export function GraphBlockView({ block }: { block: GraphBlock }) {
  const initialNodes: NodeData[] = useMemo(() => block.vertices.map((v) => ({
    id: v.id,
    type: "neo",
    x: 0,
    y: 0,
    width: 150, // width approximate to min-w-[120px] and max-w-[200px]
    height: 80, // height approximate to min-h-[60px] + padding
    data: { label: v.display, nav_target: v.nav_target },
  })), [block.vertices]);

  const initialEdges: EdgeData[] = useMemo(() => block.edges.map((e) => ({
    source: e.src,
    target: e.dst,
  })), [block.edges]);

  const { nodes: animatedNodes, alpha, onNodeDragStart, onNodeDrag, onNodeDragStop } = useForceLayout(
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
    const strokeColor = "#3b82f6";
    let style: any = { strokeWidth: 2.5, stroke: strokeColor };
    if (e.op === "--") style.strokeDasharray = "6 4";
    
    const edge: any = {
      id: `e-${e.src}-${e.dst}-${i}`,
      source: e.src,
      target: e.dst,
      animated: e.op === "->" || e.op === "<-",
      type: "default", // Curvy Bezier lines look more organic and less tangled than straight/orthogonal ones
      style,
    };

    if (e.op === "->" || e.op === "<->") {
      edge.markerEnd = { type: MarkerType.ArrowClosed, width: 12, height: 12, color: strokeColor };
    }
    if (e.op === "<-" || e.op === "<->") {
      edge.markerStart = { type: MarkerType.ArrowClosed, width: 12, height: 12, color: strokeColor };
    }
    
    return edge;
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
    <div id={block.explicit_id || undefined} className="w-full h-[560px] border border-border rounded-lg overflow-hidden bg-surface relative">
      <ReactFlowProvider>
        <GraphInner 
          block={block}
          nodes={nodes}
          edgesState={edgesState}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          simulationAlpha={alpha}
        />
      </ReactFlowProvider>
    </div>
  );
}


