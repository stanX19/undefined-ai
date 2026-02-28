import { memo, useMemo } from "react";
import {
    ReactFlow,
    Controls,
    Background,
    Handle,
    Position,
    useNodesState,
    useEdgesState
} from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { UIGraph, UINode, UIEdge } from "../../types.ts";
import { useUIStore } from "../../store.ts";
import { parseSafeStyle } from "../ElementRenderer.tsx";

// Custom Node Component for Premium Aesthetics
const CustomNode = memo(({ data }: { data: any }) => {
    const isAvailable = data.status === "available";
    const isCompleted = data.status === "completed";
    const isLocked = data.status === "locked";

    let statusClass = "border-(--color-border) bg-(--color-surface)";
    if (isAvailable) statusClass = "border-(--a2ui-primary,var(--color-primary)) bg-(--a2ui-primary,var(--color-primary))/5 ring-2 ring-(--a2ui-primary,var(--color-primary))/20 cursor-pointer";
    if (isCompleted) statusClass = "border-green-500 bg-green-500/10";
    if (isLocked) statusClass = "border-gray-300 bg-gray-100 opacity-60 grayscale";

    return (
        <div className={`w-64 rounded-xl border p-4 shadow-sm backdrop-blur-sm transition-all hover:shadow-md ${statusClass}`}>
            <Handle type="target" position={Position.Top} className="!bg-(--color-text-muted)" />

            <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-(--color-text-primary)">{data.title}</h3>
                <p className="text-xs text-(--color-text-muted) line-clamp-3">{data.description}</p>

                {data.difficulty !== undefined && (
                    <div className="mt-2 flex items-center gap-1">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-(--color-text-muted)">Difficulty</span>
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-(--color-border)">
                            <div
                                className="h-full bg-(--a2ui-primary,var(--color-primary))"
                                style={{ width: `${Math.max(data.difficulty * 100, 5)}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            <Handle type="source" position={Position.Bottom} className="!bg-(--color-text-muted)" />
        </div>
    );
});

const nodeTypes = {
    customTask: CustomNode,
};

// Very basic automatic linear/grid layout since we don't have dagre installed
function autoLayout(nodes: Node[], edges: Edge[]) {
    const nodeWidth = 280;
    const nodeHeight = 150;

    // Find roots (nodes with no incoming edges)
    const incomingCount: Record<string, number> = {};
    nodes.forEach(n => incomingCount[n.id] = 0);
    edges.forEach(e => {
        if (incomingCount[e.target] !== undefined) {
            incomingCount[e.target]++;
        }
    });

    const roots = nodes.filter(n => incomingCount[n.id] === 0);

    // If no clear roots (cyles), just take the first
    const queue = roots.length > 0 ? [...roots] : (nodes.length > 0 ? [nodes[0]] : []);

    const levels: Record<string, number> = {};
    queue.forEach(q => levels[q.id] = 0);

    let currentIdx = 0;
    while (currentIdx < queue.length) {
        const current = queue[currentIdx];
        currentIdx++;

        const currLevel = levels[current.id];

        // Find neighbors
        const outgoing = edges.filter(e => e.source === current.id);
        outgoing.forEach(edge => {
            const targetId = edge.target;
            levels[targetId] = Math.max(levels[targetId] || 0, currLevel + 1);
            if (!queue.find(n => n.id === targetId)) {
                const tNode = nodes.find(n => n.id === targetId);
                if (tNode) queue.push(tNode);
            }
        });
    }

    // Count nodes per level to center them
    const levelCounts: Record<number, number> = {};
    const nodePositions: Record<string, { x: number, y: number }> = {};

    nodes.forEach(n => {
        const lvl = levels[n.id] || 0;
        if (levelCounts[lvl] === undefined) levelCounts[lvl] = 0;

        const x = levelCounts[lvl] * nodeWidth;
        const y = lvl * nodeHeight;

        nodePositions[n.id] = { x, y };
        levelCounts[lvl]++;
    });

    // Center horizontally
    nodes.forEach(n => {
        const lvl = levels[n.id] || 0;
        const totalWidth = levelCounts[lvl] * nodeWidth;
        const offset = -(totalWidth / 2) + (nodeWidth / 2);
        n.position = { x: nodePositions[n.id].x + offset, y: nodePositions[n.id].y };
    });

    return nodes;
}

interface GraphElementProps {
    element: UIGraph;
}

export const GraphElement = memo(function GraphElement({ element }: GraphElementProps) {
    const { className, style } = parseSafeStyle(element.style);
    const elements = useUIStore(s => s.uiJson?.elements);

    // Parse children into Nodes and Edges
    const { initialNodes, initialEdges } = useMemo(() => {
        if (!elements) return { initialNodes: [], initialEdges: [] };

        const rawNodes: Node[] = [];
        const rawEdges: Edge[] = [];

        element.children.forEach(childId => {
            const child = elements[childId];
            if (!child) return;

            if (child.type === "node") {
                const node = child as UINode;
                rawNodes.push({
                    id: childId,
                    type: "customTask",
                    position: { x: 0, y: 0 },
                    data: {
                        title: node.title,
                        description: node.description,
                        difficulty: node.difficulty,
                        status: node.status || "available"
                    }
                });
            } else if (child.type === "edge") {
                const edge = child as UIEdge;
                rawEdges.push({
                    id: childId,
                    source: edge.left,
                    target: edge.right,
                    animated: true,
                    style: { stroke: "var(--color-primary, #6366f1)", strokeWidth: 2 },
                    // bidirectional not fully supported natively by simple paths, 
                    // usually requires two edges or custom marker, we'll keep it simple
                });
            }
        });

        const laidOutNodes = autoLayout(rawNodes, rawEdges);

        return { initialNodes: laidOutNodes, initialEdges: rawEdges };
    }, [element.children, elements]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Re-sync if backend updates graph remotely
    useMemo(() => {
        setNodes(initialNodes);
        setEdges(initialEdges);
    }, [initialNodes, initialEdges, setNodes, setEdges]);

    return (
        <div className={`h-[500px] w-full overflow-hidden rounded-2xl border border-(--color-border) bg-[var(--color-surface)] shadow-sm ${className}`} style={style}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                attributionPosition="bottom-right"
                className="bg-gray-50/50"
            >
                <Background color="#cbd5e1" gap={16} />
                <Controls />
            </ReactFlow>
        </div>
    );
});
