import { useState, useEffect, useMemo } from "react";

export interface ForceNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
}

export interface ForceEdge {
  source: string;
  target: string;
}

export interface ForceBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Force-directed layout simulation bounded within a container.
 * Used specifically for :::graph blocks.
 *
 * Supports:
 * - Node repulsion (Coulomb-like)
 * - Edge spring attraction (Hooke-like)
 * - Center gravity
 * - Wall repulsion (soft inward force near edges)
 */
export function useForceLayout(
  nodes: ForceNode[],
  edges: ForceEdge[],
  bounds: ForceBounds,
) {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

  // Stable identity for nodes/edges via JSON key
  const nodeKey = useMemo(() => nodes.map((n) => n.id).join(","), [nodes]);
  const edgeKey = useMemo(
    () => edges.map((e) => `${e.source}-${e.target}`).join(","),
    [edges],
  );

  useEffect(() => {
    if (nodes.length === 0) return;

    let animationFrameId: number;
    let iteration = 0;
    const MAX_ITERATIONS = 300;

    const REPULSION = 30000;
    const K_SPRING = 0.3;
    const SPRING_REST = 140;
    const DAMPING = 0.85;
    const CENTER_GRAVITY = 0.03;
    const WALL_FORCE = 200;
    const WALL_MARGIN = 40;

    const cx = bounds.x + bounds.w / 2;
    const cy = bounds.y + bounds.h / 2;

    // Clone nodes for simulation state
    const simNodes = nodes.map((n, i) => ({
      ...n,
      x: cx + (Math.cos((i / nodes.length) * Math.PI * 2) * bounds.w * 0.25),
      y: cy + (Math.sin((i / nodes.length) * Math.PI * 2) * bounds.h * 0.25),
      vx: 0,
      vy: 0,
    }));

    const nodeById = new Map(simNodes.map((n) => [n.id, n]));

    function tick() {
      iteration++;

      // --- Repulsion between all pairs ---
      for (let i = 0; i < simNodes.length; i++) {
        const n1 = simNodes[i];

        // Center gravity
        n1.vx += (cx - n1.x) * CENTER_GRAVITY;
        n1.vy += (cy - n1.y) * CENTER_GRAVITY;

        for (let j = i + 1; j < simNodes.length; j++) {
          const n2 = simNodes[j];
          const dx = n1.x - n2.x;
          const dy = n1.y - n2.y;
          const distSq = dx * dx + dy * dy || 1;
          const dist = Math.sqrt(distSq);

          const force = REPULSION / distSq;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          n1.vx += fx;
          n1.vy += fy;
          n2.vx -= fx;
          n2.vy -= fy;
        }
      }

      // --- Spring attraction along edges ---
      for (const edge of edges) {
        const source = nodeById.get(edge.source);
        const target = nodeById.get(edge.target);
        if (!source || !target) continue;

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - SPRING_REST) * K_SPRING;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      }

      // --- Wall repulsion (soft inward force) ---
      for (const node of simNodes) {
        const left = node.x - bounds.x;
        const right = (bounds.x + bounds.w) - node.x;
        const top = node.y - bounds.y;
        const bottom = (bounds.y + bounds.h) - node.y;

        if (left < WALL_MARGIN) node.vx += WALL_FORCE / (left * left || 1);
        if (right < WALL_MARGIN) node.vx -= WALL_FORCE / (right * right || 1);
        if (top < WALL_MARGIN) node.vy += WALL_FORCE / (top * top || 1);
        if (bottom < WALL_MARGIN) node.vy -= WALL_FORCE / (bottom * bottom || 1);
      }

      // --- Apply velocity, damping, clamping ---
      const newPos: Record<string, { x: number; y: number }> = {};
      let maxSpeed = 0;

      for (const node of simNodes) {
        node.vx *= DAMPING;
        node.vy *= DAMPING;

        // Speed limit
        const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        if (speed > 15) {
          node.vx = (node.vx / speed) * 15;
          node.vy = (node.vy / speed) * 15;
        }

        node.x += node.vx;
        node.y += node.vy;

        // Hard clamp to bounds
        const hw = node.width / 2;
        const hh = node.height / 2;
        node.x = Math.max(bounds.x + hw, Math.min(bounds.x + bounds.w - hw, node.x));
        node.y = Math.max(bounds.y + hh, Math.min(bounds.y + bounds.h - hh, node.y));

        newPos[node.id] = { x: node.x, y: node.y };
        maxSpeed = Math.max(maxSpeed, speed);
      }

      setPositions(newPos);

      if (maxSpeed > 0.3 && iteration < MAX_ITERATIONS) {
        animationFrameId = requestAnimationFrame(tick);
      }
    }

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [nodeKey, edgeKey, bounds.x, bounds.y, bounds.w, bounds.h]);

  return positions;
}
