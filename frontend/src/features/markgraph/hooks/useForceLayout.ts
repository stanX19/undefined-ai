import { useState, useEffect, useRef } from "react";

export interface NodeData {
  id: string;
  type: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  data: any;
}

export interface EdgeData {
  source: string;
  target: string;
}

export function useForceLayout(nodes: NodeData[], edges: EdgeData[], width: number, height: number) {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  useEffect(() => {
    let animationFrameId: number;
    const K = 0.5; // Spring constant
    const REPULSION = 40000;
    const DAMPING = 0.8;
    const CENTER_GRAVITY = 0.05;

    // Initialize node state if empty
    const layoutNodes = nodesRef.current.map((n, i) => ({
      ...n,
      x: n.x || width / 2 + (Math.random() * 100 - 50),
      y: n.y || height / 2 + (Math.random() * 100 - 50),
      vx: 0,
      vy: 0,
    }));

    function tick() {
      // Repulsion
      for (let i = 0; i < layoutNodes.length; i++) {
        const n1 = layoutNodes[i];
        
        // Gravity to center
        n1.vx += (width / 2 - n1.x) * CENTER_GRAVITY;
        n1.vy += (height / 2 - n1.y) * CENTER_GRAVITY;

        for (let j = i + 1; j < layoutNodes.length; j++) {
          const n2 = layoutNodes[j];
          const dx = n1.x - n2.x;
          const dy = n1.y - n2.y;
          const distSq = dx * dx + dy * dy || 1;
          const dist = Math.sqrt(distSq);

          // Calculate overlap / repulsive force
          // We want nodes to repel based on their bounding boxes roughly
          const minD = (n1.width + n2.width) / 2 + 20; 
          
          if (dist < minD * 2) {
             const force = REPULSION / distSq;
             const fx = (dx / dist) * force;
             const fy = (dy / dist) * force;
             n1.vx += fx;
             n1.vy += fy;
             n2.vx -= fx;
             n2.vy -= fy;
          }
        }
      }

      // Spring attraction (if edges exist)
      for (const edge of edgesRef.current) {
        const source = layoutNodes.find((n) => n.id === edge.source);
        const target = layoutNodes.find((n) => n.id === edge.target);
        if (source && target) {
          const targetDist = 200;
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            const force = (dist - targetDist) * K;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            source.vx += fx;
            source.vy += fy;
            target.vx -= fx;
            target.vy -= fy;
          }
        }
      }

      // Apply forces
      const newPos: Record<string, { x: number; y: number }> = {};
      let maxVelocity = 0;

      for (const node of layoutNodes) {
        node.vx *= DAMPING;
        node.vy *= DAMPING;
        
        // Limit max velocity
        const speed = Math.sqrt(node.vx*node.vx + node.vy*node.vy);
        if (speed > 20) {
           node.vx = (node.vx/speed) * 20;
           node.vy = (node.vy/speed) * 20;
        }

        node.x += node.vx;
        node.y += node.vy;
        
        // Keep within bounds
        node.x = Math.max(node.width / 2, Math.min(width - node.width / 2, node.x));
        node.y = Math.max(node.height / 2, Math.min(height - node.height / 2, node.y));

        newPos[node.id] = { x: node.x, y: node.y };
        maxVelocity = Math.max(maxVelocity, speed);
      }

      setPositions(newPos);

      // Stop loop if it cools down
      if (maxVelocity > 0.5) {
        animationFrameId = requestAnimationFrame(tick);
      }
    }

    if (nodesRef.current.length > 0) {
       animationFrameId = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [width, height]);

  return positions;
}
