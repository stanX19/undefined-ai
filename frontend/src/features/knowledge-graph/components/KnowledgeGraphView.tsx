import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ReactFlow,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  ConnectionMode,
  useReactFlow,
  useInternalNode,
  BaseEdge,
  Background,
  BackgroundVariant,
  type EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GitBranch, RefreshCw, X } from "lucide-react";
import { useForceLayout } from "../../markgraph/hooks/useForceLayout";
import type { NodeData, EdgeData } from "../../markgraph/hooks/useForceLayout";
import { useKnowledgeGraphStore } from "../store";
import type { KGNode, KGEdge } from "../types";

// ─── Color palette ─────────────────────────────────────────────────────────────
const COLOR = {
  root:    "#22C55E", // green  — centre hub
  summary: "#3B82F6", // blue   — mid-level summaries
  fact:    "#EC4899", // pink   — atomic facts
};

const NODE_SIZE = {
  root:    { w: 92, h: 92 },
  summary: { w: 72, h: 72 },
  fact:    { w: 58, h: 58 },
};

// ─── Custom node components ────────────────────────────────────────────────────

function CircleNode({
  color,
  size,
  label,
  fullContent,
}: {
  color: string;
  size: number;
  label: string;
  fullContent: string;
}) {
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const maxChars = Math.floor(size / 6.5);
  const display = label.length > maxChars ? label.slice(0, maxChars).trimEnd() + "…" : label;

  // Throttle tooltip repositioning to one update per animation frame so that
  // 100+ node instances don't each trigger a React re-render on every mousemove.
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const x = e.clientX;
    const y = e.clientY;
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setMousePos({ x, y });
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setMousePos(null);
  }, []);

  return (
    <div
      style={{ position: "relative", width: size, height: size }}
      onMouseEnter={handleMouseMove}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Circle */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          boxShadow: mousePos
            ? `0 4px 18px 0 ${color}55`
            : `0 2px 8px 0 ${color}33`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 6,
          transition: "box-shadow 0.2s",
        }}
      >
        <span
          style={{
            color: "#fff",
            fontSize: size >= 80 ? 10 : size >= 65 ? 9 : 8,
            fontWeight: 600,
            textAlign: "center",
            lineHeight: 1.35,
            wordBreak: "break-word",
            fontFamily: "system-ui, sans-serif",
            userSelect: "none",
          }}
        >
          {display}
        </span>
      </div>

      {/* Portal tooltip — renders at document.body so it's always on top */}
      {mousePos && createPortal(
        <div
          style={{
            position: "fixed",
            left: mousePos.x + 14,
            top: mousePos.y - 48,
            maxWidth: 260,
            background: "#FFFFFF",
            border: "1px solid #E0DEDB",
            borderRadius: 10,
            padding: "9px 13px",
            zIndex: 99999,
            color: "#37322F",
            fontSize: 12,
            lineHeight: 1.6,
            pointerEvents: "none",
            boxShadow: "0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)",
            fontFamily: "system-ui, sans-serif",
            whiteSpace: "normal",
            wordBreak: "break-word",
          }}
        >
          {fullContent}
        </div>,
        document.body,
      )}

      {/* Centered handles — floating edge does its own path calculation */}
      <Handle type="source" position={Position.Left}  style={{ opacity: 0, width: 0, height: 0, top: "50%", left: "50%" }} />
      <Handle type="target" position={Position.Right} style={{ opacity: 0, width: 0, height: 0, top: "50%", left: "50%" }} />
    </div>
  );
}

// ─── Floating straight edge ────────────────────────────────────────────────────
// Connects to the nearest point on the circular border of each node
// rather than a fixed top/bottom anchor.

function FloatingEdge({ id, source, target, style }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!sourceNode || !targetNode) return null;

  const sx = sourceNode.internals.positionAbsolute.x + (sourceNode.measured?.width  ?? 60) / 2;
  const sy = sourceNode.internals.positionAbsolute.y + (sourceNode.measured?.height ?? 60) / 2;
  const tx = targetNode.internals.positionAbsolute.x + (targetNode.measured?.width  ?? 60) / 2;
  const ty = targetNode.internals.positionAbsolute.y + (targetNode.measured?.height ?? 60) / 2;

  const dx   = tx - sx;
  const dy   = ty - sy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return null;

  const srcR = (sourceNode.measured?.width ?? 60) / 2;
  const dstR = (targetNode.measured?.width ?? 60) / 2;

  // Start/end exactly on the circle borders
  const x1 = sx + (dx / dist) * srcR;
  const y1 = sy + (dy / dist) * srcR;
  const x2 = tx - (dx / dist) * dstR;
  const y2 = ty - (dy / dist) * dstR;

  return <BaseEdge id={id} path={`M ${x1} ${y1} L ${x2} ${y2}`} style={style} />;
}

function RootNode({ data }: any) {
  return (
    <CircleNode
      color={COLOR.root}
      size={NODE_SIZE.root.w}
      label={data.label}
      fullContent={data.full_content}
    />
  );
}

function SummaryNode({ data }: any) {
  return (
    <CircleNode
      color={COLOR.summary}
      size={NODE_SIZE.summary.w}
      label={data.label}
      fullContent={data.full_content}
    />
  );
}

function FactNode({ data }: any) {
  return (
    <CircleNode
      color={COLOR.fact}
      size={NODE_SIZE.fact.w}
      label={data.label}
      fullContent={data.full_content}
    />
  );
}

const nodeTypes = { kgRoot: RootNode, kgSummary: SummaryNode, kgFact: FactNode };
const edgeTypes = { floating: FloatingEdge };

// ─── Builders ─────────────────────────────────────────────────────────────────

function buildFlowNodes(kgNodes: KGNode[]): NodeData[] {
  return kgNodes.map((n) => {
    const s =
      n.level === -1 ? NODE_SIZE.root
      : n.level === 2 ? NODE_SIZE.summary
      : NODE_SIZE.fact;
    return {
      id: n.id,
      type: n.level === -1 ? "kgRoot" : n.level === 2 ? "kgSummary" : "kgFact",
      x: 0,
      y: 0,
      width: s.w,
      height: s.h,
      data: { label: n.label, full_content: n.full_content },
    };
  });
}

function buildFlowEdges(kgEdges: KGEdge[]) {
  return kgEdges.map((e, i) => ({
    id: `kg-e-${i}`,
    source: e.source,
    target: e.target,
    type: "floating",                         // custom: nearest-border straight line
    style: { stroke: "#CBD5E1", strokeWidth: 1 },
    // no markerEnd — no arrows
  }));
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { color: COLOR.root,    label: "Topic root" },
    { color: COLOR.summary, label: "Summary"    },
    { color: COLOR.fact,    label: "Fact"       },
  ];
  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        right: 16,
        background: "rgba(250,249,248,0.92)",
        border: "1px solid #E0DEDB",
        borderRadius: 10,
        padding: "8px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        zIndex: 10,
        backdropFilter: "blur(6px)",
      }}
    >
      {items.map(({ color, label }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "#605A57", fontFamily: "system-ui, sans-serif" }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Inner ReactFlow ──────────────────────────────────────────────────────────

function GraphInner({ nodes, edges, onNodesChange, onEdgesChange, onNodeDragStart, onNodeDrag, onNodeDragStop, simulationAlpha }: any) {
  const { fitView } = useReactFlow();
  const didFit = useRef(false);

  useEffect(() => {
    if (!didFit.current && simulationAlpha < 0.1 && nodes.length > 0) {
      didFit.current = true;
      setTimeout(() => fitView({ duration: 700, padding: 0.2 }), 80);
    }
  }, [simulationAlpha, nodes.length, fitView]);

  useEffect(() => { didFit.current = false; }, [nodes.length]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      proOptions={{ hideAttribution: true }}
      onNodeDragStart={onNodeDragStart}
      onNodeDrag={onNodeDrag}
      onNodeDragStop={onNodeDragStop}
      connectionMode={ConnectionMode.Loose}
      minZoom={0.1}
      maxZoom={2.5}
      colorMode="light"
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1}
        color="#D4D0CC"
        style={{ background: "#FAF9F8" }}
      />
      <Controls
        showInteractive={false}
        style={{
          background: "#FAF9F8",
          border: "1px solid #E0DEDB",
          borderRadius: 8,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
      />
      <Legend />
    </ReactFlow>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface KnowledgeGraphViewProps {
  topicId: string;
  topicTitle: string;
  onClose: () => void;
}

export function KnowledgeGraphView({ topicId, topicTitle, onClose }: KnowledgeGraphViewProps) {
  const { data, isLoading, error, fetchGraph } = useKnowledgeGraphStore();

  useEffect(() => {
    fetchGraph(topicId, topicTitle);
  }, [topicId, topicTitle, fetchGraph]);

  const kgNodes = data?.nodes ?? [];
  const kgEdges = data?.edges ?? [];

  const initialNodes = useMemo(() => buildFlowNodes(kgNodes), [kgNodes]);
  const d3Edges: EdgeData[] = useMemo(
    () => kgEdges.map((e) => ({ source: e.source, target: e.target })),
    [kgEdges],
  );

  const { nodes: animatedNodes, alpha, onNodeDragStart, onNodeDrag, onNodeDragStop } =
    useForceLayout(initialNodes, d3Edges, 1100, 700);

  const reactFlowNodes = useMemo(
    () => animatedNodes.map((n) => ({ id: n.id, position: { x: n.x ?? 0, y: n.y ?? 0 }, data: n.data, type: n.type })),
    [animatedNodes],
  );

  const reactFlowEdges = useMemo(() => buildFlowEdges(kgEdges), [kgEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);

  // Sync edges whenever graph data loads or refreshes.
  // useEdgesState only uses its argument for initialization, so we must
  // push updates manually — this is why edges went missing until remount.
  useEffect(() => {
    setEdges(reactFlowEdges);
  }, [reactFlowEdges, setEdges]);

  // Sync D3 node positions into React Flow on every simulation tick.
  // Uses a Map for O(1) lookups — the naive find() approach was O(n²) per tick.
  useEffect(() => {
    setNodes((nds) => {
      if (nds.length === 0 && reactFlowNodes.length > 0) return reactFlowNodes;
      // Build id→position map once (O(n)) instead of find() per node (O(n²))
      const posMap = new Map(reactFlowNodes.map(n => [n.id, n.position]));
      let changed = false;
      const next = nds.map((node) => {
        const pos = posMap.get(node.id);
        if (pos && (node.position.x !== pos.x || node.position.y !== pos.y)) {
          changed = true;
          return { ...node, position: pos };
        }
        return node;
      });
      return changed ? next : nds;
    });
  }, [reactFlowNodes, setNodes]);

  const nodeCount = kgNodes.length;
  const edgeCount = kgEdges.length;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        background: "#FAF9F8",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header — matches workspace top bar style */}
      <div
        style={{
          height: 48,
          borderBottom: "1px solid #E0DEDB",
          background: "#FAF9F8",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <GitBranch size={15} color="#605A57" />
          <span style={{ color: "#49423D", fontSize: 13, fontWeight: 600, fontFamily: "system-ui, sans-serif" }}>
            Knowledge Graph
          </span>
          {!isLoading && nodeCount > 0 && (
            <span
              style={{
                background: "rgba(55,50,47,0.06)",
                border: "1px solid #E0DEDB",
                borderRadius: 20,
                padding: "2px 10px",
                color: "#605A57",
                fontSize: 11,
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {nodeCount} nodes · {edgeCount} edges
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => fetchGraph(topicId, topicTitle)}
            title="Refresh"
            style={{
              background: "transparent",
              border: "1px solid #E0DEDB",
              borderRadius: 8,
              padding: "5px 10px",
              cursor: "pointer",
              color: "#605A57",
              display: "flex",
              alignItems: "center",
              height: 28,
            }}
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={onClose}
            title="Back to canvas"
            style={{
              background: "transparent",
              border: "1px solid #E0DEDB",
              borderRadius: 8,
              padding: "5px 10px",
              cursor: "pointer",
              color: "#605A57",
              fontSize: 12,
              fontFamily: "system-ui, sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 5,
              height: 28,
            }}
          >
            <X size={13} />
            Close
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {isLoading && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, background: "#FAF9F8", zIndex: 10 }}>
            <div style={{ width: 28, height: 28, border: "2.5px solid #E0DEDB", borderTop: "2.5px solid #605A57", borderRadius: "50%", animation: "spin 0.85s linear infinite" }} />
            <span style={{ color: "#8F8480", fontSize: 13, fontFamily: "system-ui, sans-serif" }}>Building graph…</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {!isLoading && error && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#FAF9F8" }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ color: "#8F8480", fontSize: 13, marginBottom: 10, fontFamily: "system-ui, sans-serif" }}>Failed to load graph</p>
              <button
                onClick={() => fetchGraph(topicId, topicTitle)}
                style={{ background: "#FAF9F8", border: "1px solid #E0DEDB", borderRadius: 8, padding: "6px 16px", color: "#605A57", fontSize: 12, cursor: "pointer", fontFamily: "system-ui, sans-serif" }}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!isLoading && !error && nodeCount <= 1 && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: "#FAF9F8" }}>
            <GitBranch size={36} color="#D4D0CC" />
            <p style={{ color: "#8F8480", fontSize: 14, fontFamily: "system-ui, sans-serif", textAlign: "center", lineHeight: 1.6 }}>
              No knowledge extracted yet.
              <br />
              <span style={{ fontSize: 12, color: "#C0BBB8" }}>Upload a document or chat to build the graph.</span>
            </p>
          </div>
        )}

        {!isLoading && !error && nodeCount > 1 && (
          <ReactFlowProvider>
            <GraphInner
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDragStart={onNodeDragStart}
              onNodeDrag={onNodeDrag}
              onNodeDragStop={onNodeDragStop}
              simulationAlpha={alpha}
            />
          </ReactFlowProvider>
        )}
      </div>
    </div>
  );
}
