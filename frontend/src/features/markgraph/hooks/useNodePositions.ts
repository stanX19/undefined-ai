import { create } from "zustand";

export interface NodeRect {
  x: number;
  y: number;
  w: number;
  h: number;
  userMoved: boolean;
}

interface NodePositionState {
  positions: Record<string, NodeRect>;

  /** Bulk-set from tree layout. Only updates nodes that haven't been user-moved. */
  initFromTreeLayout: (layout: Record<string, NodeRect>) => void;

  /** Set a single node's position (from drag / resize). Marks userMoved = true. */
  setPosition: (id: string, rect: Partial<NodeRect>) => void;

  /** Full reset (e.g. when AST changes). */
  reset: () => void;
}

export const useNodePositions = create<NodePositionState>((set) => ({
  positions: {},

  initFromTreeLayout: (layout) =>
    set((state) => {
      const merged = { ...layout };
      // Preserve user-moved positions
      for (const [id, rect] of Object.entries(state.positions)) {
        if (rect.userMoved) {
          merged[id] = rect;
        }
      }
      return { positions: merged };
    }),

  setPosition: (id, rect) =>
    set((state) => ({
      positions: {
        ...state.positions,
        [id]: {
          ...(state.positions[id] ?? { x: 0, y: 0, w: 200, h: 100, userMoved: false }),
          ...rect,
          userMoved: true,
        },
      },
    })),

  reset: () => set({ positions: {} }),
}));
