import { useMemo } from "react";
import {
  ReactFlow,
  type Node,
  type Edge,
  Background,
  Controls,
  MiniMap,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { A2UIComponentProps } from "../../a2ui/registry.ts";
import { resolvePointer } from "../../a2ui/resolver.ts";

interface MindMapData {
  nodes?: Array<{ id: string; label: string; x?: number; y?: number }>;
  edges?: Array<{ source: string; target: string; label?: string }>;
}

export function A2UIMindMap({
  definition,
  dataModel,
  scopePrefix,
}: A2UIComponentProps) {
  const rawData = definition.data
    ? typeof definition.data === "object" &&
      definition.data !== null &&
      "path" in (definition.data as Record<string, unknown>)
      ? (resolvePointer(
          dataModel,
          (definition.data as { path: string }).path,
          scopePrefix,
        ) as MindMapData)
      : (definition.data as MindMapData)
    : undefined;

  const { nodes, edges } = useMemo(() => {
    if (!rawData?.nodes) return { nodes: [] as Node[], edges: [] as Edge[] };

    const flowNodes: Node[] = rawData.nodes.map((n, i) => ({
      id: n.id,
      position: { x: n.x ?? (i % 4) * 220, y: n.y ?? Math.floor(i / 4) * 120 },
      data: { label: n.label },
      style: {
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 12,
        padding: "8px 16px",
        fontSize: 14,
      },
    }));

    const flowEdges: Edge[] = (rawData.edges ?? []).map((e, i) => ({
      id: `edge-${i}`,
      source: e.source,
      target: e.target,
      label: e.label,
      animated: true,
    }));

    return { nodes: flowNodes, edges: flowEdges };
  }, [rawData]);

  if (nodes.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[var(--color-text-muted)]">
        No graph data available
      </div>
    );
  }

  return (
    <div className="h-96 w-full rounded-xl border border-[var(--color-border)]">
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
