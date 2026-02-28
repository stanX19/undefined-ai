import { memo, useMemo, useEffect, useState, useCallback } from "react";
import {
    ReactFlow,
    Controls,
    Background,
    Handle,
    Position,
    useNodesState,
    useEdgesState,
    useInternalNode,
    BaseEdge,
    getBezierPath,
    MarkerType
} from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X } from "lucide-react";
import type { UIGraph, UINode, UIEdge } from "../../types.ts";
import { useUIStore } from "../../store.ts";
import { parseSafeStyle } from "../ElementRenderer.tsx";

// --- Node Position Math for Floating Edges ---
function getNodeIntersection(intersectionNode: any, targetNode: any) {
    if (!intersectionNode?.measured || !targetNode?.measured) return { x: 0, y: 0 };

    const { width: intersectionNodeWidth, height: intersectionNodeHeight } = intersectionNode.measured;
    const intersectionNodePosition = intersectionNode.internals.positionAbsolute;
    const targetPosition = targetNode.internals.positionAbsolute;

    const w = intersectionNodeWidth / 2;
    const h = intersectionNodeHeight / 2;

    const x2 = intersectionNodePosition.x + w;
    const y2 = intersectionNodePosition.y + h;
    const x1 = targetPosition.x + targetNode.measured.width / 2;
    const y1 = targetPosition.y + targetNode.measured.height / 2;

    const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
    const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);

    const sumAbs = Math.abs(xx1) + Math.abs(yy1);
    const a = sumAbs > 0 ? 1 / sumAbs : 0;

    const xx3 = a * xx1;
    const yy3 = a * yy1;
    const x = w * (xx3 + yy3) + x2;
    const y = h * (-xx3 + yy3) + y2;

    return { x, y };
}

function getEdgePosition(node: any, intersectionPoint: any) {
    const n = { ...node.internals.positionAbsolute, ...node };
    const nx = Math.round(n.x);
    const ny = Math.round(n.y);
    const px = Math.round(intersectionPoint.x);
    const py = Math.round(intersectionPoint.y);

    if (px <= nx + 1) return Position.Left;
    if (px >= nx + n.measured.width - 1) return Position.Right;
    if (py <= ny + 1) return Position.Top;
    if (py >= ny + n.measured.height - 1) return Position.Bottom;

    return Position.Top;
}

function getEdgeParams(source: any, target: any) {
    const sourceIntersectionPoint = getNodeIntersection(source, target);
    const targetIntersectionPoint = getNodeIntersection(target, source);

    const sourcePos = getEdgePosition(source, sourceIntersectionPoint);
    const targetPos = getEdgePosition(target, targetIntersectionPoint);

    return {
        sx: sourceIntersectionPoint.x,
        sy: sourceIntersectionPoint.y,
        tx: targetIntersectionPoint.x,
        ty: targetIntersectionPoint.y,
        sourcePos,
        targetPos,
    };
}

// --- Floating Edge Component ---
const FloatingEdge = memo(function FloatingEdge({ id, source, target, markerEnd, style, animated }: any) {
    const sourceNode = useInternalNode(source);
    const targetNode = useInternalNode(target);

    if (!sourceNode || !targetNode || !sourceNode.measured?.width || !targetNode.measured?.width) {
        return null; // Don't crash if ReactFlow is still calculating bounds during first tick
    }

    const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(sourceNode, targetNode);

    const [edgePath] = getBezierPath({
        sourceX: sx,
        sourceY: sy,
        sourcePosition: sourcePos,
        targetPosition: targetPos,
        targetX: tx,
        targetY: ty,
    });

    const baseColor = typeof style?.stroke === 'string' ? style.stroke : 'var(--ds-border)';

    return (
        <BaseEdge
            path={edgePath}
            markerEnd={markerEnd}
            style={{
                ...style,
                stroke: baseColor,
                strokeWidth: 2,
                ...(animated ? { strokeDasharray: '5,5', animation: 'dashdraw 0.5s linear infinite' } : {})
            }}
            className={`react-flow__edge-path ${animated ? 'animated' : ''}`}
            id={id}
        />
    );
});


// --- Custom Node Component ---
const CustomNode = memo(({ data }: { data: any }) => {
    const cleanTitle = data.title ? data.title.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu, '').trim() : '';

    return (
        <div className="group relative flex min-w-[200px] max-w-[320px] cursor-pointer items-center justify-center rounded-[24px] border border-slate-300/50 bg-slate-200/40 backdrop-blur-md px-8 py-5 shadow-[0_4px_12px_rgba(0,0,0,0.03)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(0,0,0,0.06)] hover:border-slate-400/50 hover:bg-slate-200/60">
            {/* Invisible handles for floating edge intersection */}
            <Handle type="target" position={Position.Top} className="!absolute !left-1/2 !top-1/2 !opacity-0 -z-10" isConnectable={false} />
            <Handle type="source" position={Position.Bottom} className="!absolute !left-1/2 !top-1/2 !opacity-0 -z-10" isConnectable={false} />

            <h3 className="text-[15px] font-bold tracking-tight text-slate-800 leading-snug px-2 text-center select-none uppercase">{cleanTitle}</h3>

            {/* Subtle glow effect on hover */}
            <div className="absolute inset-0 rounded-[24px] ring-1 ring-white/10 group-hover:ring-white/30 transition-all" />
        </div>
    );
});

const nodeTypes = {
    customTask: CustomNode,
};

const edgeTypes = {
    floating: FloatingEdge,
};

// --- Better Auto Layout (Radial Geometry) ---
function autoLayout(nodes: Node[], edges: Edge[]) {
    const radiusStep = 220; // Vastly reduced to compact nodes closer together

    const incoming: Record<string, string[]> = {};
    const outgoing: Record<string, string[]> = {};
    nodes.forEach(n => { incoming[n.id] = []; outgoing[n.id] = []; });

    edges.forEach(e => {
        if (incoming[e.target]) incoming[e.target].push(e.source);
        if (outgoing[e.source]) outgoing[e.source].push(e.target);
    });

    const levels: Record<string, number> = {};
    const visited = new Set<string>();

    // Calculate hierarchical DAG Depth
    while (visited.size < nodes.length) {
        const unvisited = nodes.filter(n => !visited.has(n.id));
        unvisited.sort((a, b) => incoming[a.id].length - incoming[b.id].length);
        const root = unvisited[0];

        const queue = [root];
        if (levels[root.id] === undefined) levels[root.id] = 0;

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current.id)) continue;
            visited.add(current.id);

            const currLevel = levels[current.id];

            outgoing[current.id].forEach(targetId => {
                if (!visited.has(targetId)) {
                    levels[targetId] = Math.max(levels[targetId] || 0, currLevel + 1);
                    queue.push(nodes.find(n => n.id === targetId)!);
                }
            });
        }
    }

    nodes.forEach(n => {
        if (levels[n.id] === undefined) levels[n.id] = 0;
    });

    const nodesByLevel: Record<number, Node[]> = {};
    nodes.forEach(n => {
        const lvl = levels[n.id];
        if (!nodesByLevel[lvl]) nodesByLevel[lvl] = [];
        nodesByLevel[lvl].push(n);
    });

    Object.keys(nodesByLevel).forEach(lvlStr => {
        nodesByLevel[parseInt(lvlStr)].sort((a, b) => {
            return outgoing[b.id].length - outgoing[a.id].length;
        });
    });

    // Map Nodes onto Concentric Circles around Central Roots
    Object.keys(nodesByLevel).forEach(lvlStr => {
        const lvl = parseInt(lvlStr);
        const siblings = nodesByLevel[lvl];

        if (lvl === 0 && siblings.length === 1) {
            // Perfect true center for single root DAGs
            siblings[0].position = { x: 0, y: 0 };
        } else {
            // Push multi-root 0-levels to a radius to prevent center pile-ups
            let currentRadius = lvl * radiusStep;
            if (lvl === 0) currentRadius = radiusStep;

            const angleStep = (2 * Math.PI) / siblings.length;

            siblings.forEach((n, index) => {
                let finalRadius = currentRadius;
                // Add staggered zigzag separation if density is high
                if (siblings.length > 5 && index % 2 !== 0) {
                    finalRadius += 100;
                }

                const angle = index * angleStep - (Math.PI / 2); // Start drawing from logical north

                const x = finalRadius * Math.cos(angle);
                const y = finalRadius * Math.sin(angle);

                n.position = { x, y };
            });
        }
    });

    return nodes;
}

interface GraphElementProps {
    element: UIGraph;
}

export const GraphElement = memo(function GraphElement({ element }: GraphElementProps) {
    const { className, style } = parseSafeStyle(element.style);
    const safeClassName = className.replace(/h-(full|auto|screen)/g, '').replace(/flex-(1|none)/g, '');
    const elements = useUIStore(s => s.uiJson?.elements);

    const [selectedNodeData, setSelectedNodeData] = useState<any>(null);

    const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
        const cleanTitle = node.data.title ? (node.data.title as string).replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu, '').trim() : '';
        setSelectedNodeData({
            ...node.data,
            title: cleanTitle
        });
    }, []);

    const closeNodeModal = useCallback(() => setSelectedNodeData(null), []);

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

                // Keep the AI's provided colors or fallback to a standard clean gray if we want the line neutral
                const userColor = edge.style?.color || "#94a3b8"; // slate-400 looks nice!

                rawEdges.push({
                    id: childId,
                    source: edge.left,
                    target: edge.right,
                    type: 'floating',
                    animated: true,
                    style: { stroke: userColor },
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        width: 15,
                        height: 15,
                        color: userColor,
                    },
                });
            }
        });

        const laidOutNodes = autoLayout(rawNodes, rawEdges);

        return { initialNodes: laidOutNodes, initialEdges: rawEdges };
    }, [element.children, elements]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Re-sync if backend updates graph remotely
    useEffect(() => {
        setNodes(initialNodes);
        setEdges(initialEdges);
    }, [initialNodes, initialEdges, setNodes, setEdges]);

    return (
        <div className={`relative min-h-[500px] flex-1 w-full overflow-hidden rounded-2xl border border-(--color-border) bg-[var(--color-surface)] shadow-sm ${safeClassName}`} style={style}>
            <div className="absolute inset-0">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeClick={onNodeClick}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.1, minZoom: 0.05, maxZoom: 1.5 }}
                    minZoom={0.05}
                    attributionPosition="bottom-right"
                >
                    <Background color="#cbd5e1" gap={24} size={1.5} />
                    <Controls className="bg-white shadow-lg rounded-xl overflow-hidden border-none" />
                </ReactFlow>
            </div>

            {/* Modal Dialog for Node Details */}
            {selectedNodeData && (
                <div
                    className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/10 backdrop-blur-[4px] p-4 animate-in fade-in duration-200"
                    onClick={closeNodeModal}
                >
                    <div
                        className="relative flex w-full max-w-md flex-col overflow-hidden rounded-[24px] border border-white/60 bg-white/95 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.08)] backdrop-blur-2xl animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={closeNodeModal}
                            className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
                        >
                            <X size={18} />
                        </button>

                        <div className="flex flex-col gap-3 mt-1 overflow-y-auto max-h-[60vh] pr-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                            <h3 className="text-[18px] font-bold tracking-tight text-slate-800 pr-6">{selectedNodeData.title}</h3>
                            <div className="text-[13px] font-medium leading-relaxed text-slate-600 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:mb-3 [&_li]:mb-1.5">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        p: ({ children }) => <p>{children}</p>,
                                        ul: ({ children }) => <ul>{children}</ul>,
                                        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                                        a: ({ children, href }) => <a href={href} className="text-blue-500 hover:text-blue-600 hover:underline">{children}</a>,
                                        code: ({ inline, children }: any) => inline ? <code className="bg-slate-100 text-slate-700 rounded px-1.5 py-0.5 text-[11px] font-mono">{children}</code> : <pre className="bg-slate-50 border border-slate-100 text-slate-700 rounded-lg p-3 overflow-x-auto my-3 text-[11px] font-mono shadow-sm shrink-0 max-w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">{children}</pre>
                                    }}
                                >
                                    {selectedNodeData.description}
                                </ReactMarkdown>
                            </div>

                            {selectedNodeData.difficulty !== undefined && (
                                <div className="mt-1 flex items-center gap-3 border-t border-slate-100 pt-3">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0">Difficulty</span>
                                    <div className="h-1.5 w-full flex-1 overflow-hidden rounded-full bg-slate-100">
                                        <div
                                            className="h-full bg-slate-300 rounded-full transition-all duration-500"
                                            style={{ width: `${Math.max(selectedNodeData.difficulty * 100, 5)}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});
