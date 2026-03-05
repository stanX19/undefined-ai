import { useRef, useCallback } from "react";
import { useNodePositions } from "./useNodePositions.ts";

/**
 * Makes any element draggable via pointer events.
 * Updates the shared nodePositions store on drag.
 */
export function useDraggable(nodeId: string) {
  const setPosition = useNodePositions((s) => s.setPosition);
  const draggingRef = useRef(false);
  const offsetRef = useRef({ dx: 0, dy: 0 });

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only left mouse / primary touch
      if (e.button !== 0) return;
      // Don't drag if clicking interactive content
      const tag = (e.target as HTMLElement).tagName;
      if (["INPUT", "TEXTAREA", "BUTTON", "SELECT", "LABEL", "A"].includes(tag)) return;

      e.preventDefault();
      e.stopPropagation();

      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);
      draggingRef.current = true;

      const rect = el.getBoundingClientRect();
      offsetRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      e.preventDefault();

      const parent = (e.currentTarget as HTMLElement).offsetParent as HTMLElement | null;
      const parentRect = parent?.getBoundingClientRect() ?? { left: 0, top: 0 };

      const x = e.clientX - parentRect.left - offsetRef.current.dx;
      const y = e.clientY - parentRect.top - offsetRef.current.dy;

      setPosition(nodeId, { x, y });
    },
    [nodeId, setPosition],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    },
    [],
  );

  return { onPointerDown, onPointerMove, onPointerUp };
}
