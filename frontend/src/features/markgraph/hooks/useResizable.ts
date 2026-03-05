import { useRef, useCallback, type CSSProperties } from "react";
import { useNodePositions } from "./useNodePositions.ts";

const MIN_W = 120;
const MIN_H = 60;

type Corner = "se" | "sw" | "ne" | "nw";

/**
 * Makes any element resizable via a corner handle.
 * Returns props for the resize handle element.
 */
export function useResizable(nodeId: string) {
  const setPosition = useNodePositions((s) => s.setPosition);
  const positions = useNodePositions((s) => s.positions);
  const resizingRef = useRef(false);
  const startRef = useRef({ mx: 0, my: 0, w: 0, h: 0, x: 0, y: 0 });
  const cornerRef = useRef<Corner>("se");

  const onHandlePointerDown = useCallback(
    (corner: Corner, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);
      resizingRef.current = true;
      cornerRef.current = corner;

      const pos = positions[nodeId];
      startRef.current = {
        mx: e.clientX,
        my: e.clientY,
        w: pos?.w ?? 200,
        h: pos?.h ?? 100,
        x: pos?.x ?? 0,
        y: pos?.y ?? 0,
      };
    },
    [nodeId, positions],
  );

  const onHandlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!resizingRef.current) return;
      e.preventDefault();

      const dx = e.clientX - startRef.current.mx;
      const dy = e.clientY - startRef.current.my;
      const c = cornerRef.current;

      let newW = startRef.current.w;
      let newH = startRef.current.h;
      let newX = startRef.current.x;
      let newY = startRef.current.y;

      if (c === "se" || c === "ne") newW = Math.max(MIN_W, startRef.current.w + dx);
      if (c === "sw" || c === "nw") {
        newW = Math.max(MIN_W, startRef.current.w - dx);
        newX = startRef.current.x + (startRef.current.w - newW);
      }
      if (c === "se" || c === "sw") newH = Math.max(MIN_H, startRef.current.h + dy);
      if (c === "ne" || c === "nw") {
        newH = Math.max(MIN_H, startRef.current.h - dy);
        newY = startRef.current.y + (startRef.current.h - newH);
      }

      setPosition(nodeId, { x: newX, y: newY, w: newW, h: newH });
    },
    [nodeId, setPosition],
  );

  const onHandlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    },
    [],
  );

  /** Returns props for a specific corner handle div. */
  const handleProps = useCallback(
    (corner: Corner) => ({
      onPointerDown: (e: React.PointerEvent) => onHandlePointerDown(corner, e),
      onPointerMove: onHandlePointerMove,
      onPointerUp: onHandlePointerUp,
      style: {
        position: "absolute" as const,
        width: 10,
        height: 10,
        background: "var(--ds-border)",
        borderRadius: 2,
        cursor:
          corner === "se" ? "se-resize" :
          corner === "sw" ? "sw-resize" :
          corner === "ne" ? "ne-resize" : "nw-resize",
        ...(corner.includes("s") ? { bottom: -4 } : { top: -4 }),
        ...(corner.includes("e") ? { right: -4 } : { left: -4 }),
        zIndex: 10,
        opacity: 0,
        transition: "opacity 0.15s",
      } satisfies CSSProperties,
    }),
    [onHandlePointerDown, onHandlePointerMove, onHandlePointerUp],
  );

  return { handleProps };
}
