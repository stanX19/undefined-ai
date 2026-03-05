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

export function useForceLayout(initialNodes: NodeData[], initialEdges: EdgeData[], width: number, height: number) {
  // We keep the nodes in state so the ReactFlow view can re-render as they move
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const simulationRef = useRef<d3.Simulation<NodeData, EdgeData> | null>(null);

  // Initialize the simulation only once or when the network structurally changes
  useEffect(() => {
    // Clone nodes and edges to avoid mutating the original data
    const nodesCopy = initialNodes.map(n => ({
      ...n,
      // Distribute randomly around the center to avoid NaN explosion from identical coordinates
      x: (typeof n.x === "number" && n.x !== 0) ? n.x : width / 2 + (Math.random() - 0.5) * 100,
      y: (typeof n.y === "number" && n.y !== 0) ? n.y : height / 2 + (Math.random() - 0.5) * 100,
    }));
    
    // d3-force modifies the source/target to object references, so clone edges
    const edgesCopy = initialEdges.map(e => ({ ...e }));

    // Create the simulation
    const simulation = d3.forceSimulation<NodeData>(nodesCopy)
      .force("charge", d3.forceManyBody().strength(-400)) // Moderated repel nodes strongly so it doesnt vanish on alpha=0.3
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.1)) // Soft gravity to center
      .force("collide", d3.forceCollide<NodeData>().radius(d => Math.max(d.width, d.height) / 2 + 10).iterations(2)) // Avoid overlap using bounding boxes
      .force("link", d3.forceLink<NodeData, EdgeData>(edgesCopy)
        .id(d => d.id)
        .distance(100) // Desired resting distance of links
        .strength(0.5)
      )
      .alphaDecay(0.02) // Cool down slower for smoother settling
      .on("tick", () => {
        // Trigger React re-render with new positions on every animation frame
        setNodes([...simulation.nodes()]);
      });

    simulationRef.current = simulation;

    // Cleanup simulation on unmount
    return () => {
      simulation.stop();
      simulationRef.current = null;
    };
  }, [width, height, initialNodes.length, initialEdges.length]);

  // Drag handlers to wire up to React Flow
  const onNodeDragStart = (_: any, node: any) => {
    if (!simulationRef.current) return;
    
    // "Reheat" the simulation to make it active again while dragging
    simulationRef.current.alphaTarget(0.3).restart();
    
    // Find the actual d3 node representation
    const d3Node = simulationRef.current.nodes().find(n => n.id === node.id);
    if (d3Node) {
       // Fix its position to where it was dragged
       d3Node.fx = d3Node.x;
       d3Node.fy = d3Node.y;
    }
  };

  const onNodeDrag = (_: any, node: any) => {
    if (!simulationRef.current) return;
    const d3Node = simulationRef.current.nodes().find(n => n.id === node.id);
    if (d3Node) {
       // Constantly update the fixed position to match the drag cursor
       d3Node.fx = node.position.x;
       d3Node.fy = node.position.y;
    }
  };

  const onNodeDragStop = (_: any, node: any) => {
    if (!simulationRef.current) return;
    const d3Node = simulationRef.current.nodes().find(n => n.id === node.id);
    if (d3Node) {
       // Release the node back to the physics engine
       d3Node.fx = null;
       d3Node.fy = null;
    }
    // Let the simulation cool down naturally
    simulationRef.current.alphaTarget(0);
  };

  return { nodes, onNodeDragStart, onNodeDrag, onNodeDragStop };
}
