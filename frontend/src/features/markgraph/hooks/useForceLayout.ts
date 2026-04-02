import { useState, useEffect, useRef } from "react";
import * as d3 from "d3-force";

export interface NodeData extends d3.SimulationNodeDatum {
  id: string;
  type: string;
  width: number;
  height: number;
  data: any;
}

export interface EdgeData extends d3.SimulationLinkDatum<NodeData> {
  source: string;
  target: string;
}

/**
 * Sugiyama-lite algorithm to calculate initial positions for a directed acyclic graph.
 * 1. Layer Assignment (Rank): Determines the Y-coordinate.
 * 2. Crossing Reduction (Barycenter heuristic): Determines the X-order.
 * 3. Coordinate Assignment: Maps ranks and orders to actual X, Y pixels.
 */
function applySugiyamaLayout(nodes: NodeData[], edges: EdgeData[], width: number, height: number): NodeData[] {
  if (nodes.length === 0) return nodes;

  const adj: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};
  nodes.forEach(n => {
    adj[n.id] = [];
    inDegree[n.id] = 0;
  });

  edges.forEach(e => {
    const src = typeof e.source === 'string' ? e.source : (e.source as any).id;
    const dst = typeof e.target === 'string' ? e.target : (e.target as any).id;
    if (adj[src]) adj[src].push(dst);
    if (inDegree[dst] !== undefined) inDegree[dst]++;
  });

  // --- Phase 1: Layer Assignment (Longest Path) ---
  const levels: Record<string, number> = {};
  const queue: string[] = nodes.filter(n => inDegree[n.id] === 0).map(n => n.id);
  
  // Initialize roots at level 0
  queue.forEach(id => levels[id] = 0);

  // BFS-like traversal to find max depth for each node
  const processed = new Set<string>();
  const workQueue = [...queue];
  
  while (workQueue.length > 0) {
    const u = workQueue.shift()!;
    processed.add(u);
    
    adj[u].forEach(v => {
      levels[v] = Math.max(levels[v] || 0, (levels[u] || 0) + 1);
      if (!processed.has(v)) workQueue.push(v);
    });
  }

  // Handle any nodes that weren't reached (cycles or disconnected)
  nodes.forEach(n => {
    if (levels[n.id] === undefined) levels[n.id] = 0;
  });

  // --- Phase 2: Ordering (Group by level and sort) ---
  const initialLayers: string[][] = [];
  Object.entries(levels).forEach(([id, level]) => {
    if (!initialLayers[level]) initialLayers[level] = [];
    initialLayers[level].push(id);
  });

  // Filter out any holes (undefined or empty) in the layers array to ensure it is contiguous
  const layers = initialLayers.filter(layer => !!layer && layer.length > 0);

  // Barycenter heuristic: Sort each level based on the average position of its parents/children
  for (let i = 1; i < layers.length; i++) {
    const currentLayer = layers[i];
    const prevLayer = layers[i - 1];
    const prevLayerIndices: Record<string, number> = {};
    prevLayer.forEach((id, idx) => prevLayerIndices[id] = idx);

    currentLayer.sort((a, b) => {
      const getBarycenter = (id: string) => {
        const parents = edges.filter(e => {
          const dst = typeof e.target === 'string' ? e.target : (e.target as any).id;
          return dst === id;
        }).map(e => typeof e.source === 'string' ? e.source : (e.source as any).id);
        
        const parentPositions = parents
          .filter(pId => prevLayerIndices[pId] !== undefined)
          .map(pId => prevLayerIndices[pId]);
        
        if (parentPositions.length === 0) return 0;
        return parentPositions.reduce((sum, val) => sum + val, 0) / parentPositions.length;
      };

      return getBarycenter(a) - getBarycenter(b);
    });
  }

  // --- Phase 3: Coordinate Assignment ---
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const verticalGap = height / (layers.length + 1);
  
  layers.forEach((layerNodes, lIdx) => {
    const horizontalGap = width / (layerNodes.length + 1);
    const y = (lIdx + 1) * verticalGap;
    
    layerNodes.forEach((id, nIdx) => {
      const node = nodeMap.get(id);
      if (node) {
        node.x = (nIdx + 1) * horizontalGap;
        node.y = y;
      }
    });
  });

  return nodes;
}

export function useForceLayout(initialNodes: NodeData[], initialEdges: EdgeData[], width: number, height: number) {
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [alpha, setAlpha] = useState(1);
  const simulationRef = useRef<d3.Simulation<NodeData, EdgeData> | null>(null);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    // 1. Pre-calculate positions using Sugiyama to prevent tangling
    const positionedNodes = applySugiyamaLayout(
      initialNodes.map(n => ({ ...n })),
      initialEdges.map(e => ({ ...e })),
      width,
      height
    );

    const edgesCopy = initialEdges.map(e => ({ ...e }));

    // Dynamic charge based on node count
    const chargeStrength = positionedNodes.length < 5 ? -200 : (positionedNodes.length < 10 ? -400 : -600);

    // 2. Initialize d3 simulation with pre-positioned nodes
    const simulation = d3.forceSimulation<NodeData>(positionedNodes)
      .force("charge", d3.forceManyBody().strength(chargeStrength)) 
      .force("x", d3.forceX(width / 2).strength(0.08)) // Stronger center pull
      .force("y", d3.forceY(height / 2).strength(0.08))
      .force("collide", d3.forceCollide<NodeData>().radius(d => Math.max(d.width, d.height) / 2 + 20).iterations(3))
      .force("link", d3.forceLink<NodeData, EdgeData>(edgesCopy)
        .id(d => d.id)
        .distance(150) 
        .strength(0.7)
      )
      .alphaDecay(0.03)
      .on("tick", () => {
        const now = performance.now();
        // Throttle updates to at most ~30fps to avoid
        // overwhelming React/ReactFlow with re-renders
        if (now - lastUpdateRef.current < 33) return;
        lastUpdateRef.current = now;

        const currentNodes = simulation.nodes();
        const currentAlpha = simulation.alpha();

        setNodes(currentNodes.slice());
        setAlpha(currentAlpha);
      });

    simulationRef.current = simulation;

    return () => {
      simulation.stop();
      simulationRef.current = null;
    };
  }, [width, height, initialNodes.length, initialEdges.length]);

  const onNodeDragStart = (_: any, node: any) => {
    if (!simulationRef.current) return;
    simulationRef.current.alphaTarget(0.3).restart();
    const d3Node = simulationRef.current.nodes().find(n => n.id === node.id);
    if (d3Node) {
       d3Node.fx = d3Node.x;
       d3Node.fy = d3Node.y;
    }
  };

  const onNodeDrag = (_: any, node: any) => {
    if (!simulationRef.current) return;
    const d3Node = simulationRef.current.nodes().find(n => n.id === node.id);
    if (d3Node) {
       d3Node.fx = node.position.x;
       d3Node.fy = node.position.y;
    }
  };

  const onNodeDragStop = (_: any, node: any) => {
    if (!simulationRef.current) return;
    const d3Node = simulationRef.current.nodes().find(n => n.id === node.id);
    if (d3Node) {
      // Release the pin so future force ticks can move this node again.
      // Without this, any node dragged once stays permanently fixed and
      // won't respond when other nodes (e.g. root) are moved.
      d3Node.fx = null;
      d3Node.fy = null;
    }
    simulationRef.current.alphaTarget(0);
  };

  return { nodes, alpha, onNodeDragStart, onNodeDrag, onNodeDragStop };
}
