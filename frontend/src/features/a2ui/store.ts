import { create } from "zustand";
import type {
  Surface,
  A2UIComponent,
  A2UITheme,
} from "./types.ts";
import { setPointer } from "./resolver.ts";

interface SurfaceState {
  surfaces: Map<string, Surface>;

  createSurface: (
    surfaceId: string,
    catalogId: string,
    theme?: A2UITheme,
    sendDataModel?: boolean,
  ) => void;

  updateComponents: (surfaceId: string, components: A2UIComponent[]) => void;

  updateDataModel: (
    surfaceId: string,
    path: string | undefined,
    value: unknown,
  ) => void;

  deleteSurface: (surfaceId: string) => void;
}

export const useSurfaceStore = create<SurfaceState>((set) => ({
  surfaces: new Map(),

  createSurface: (surfaceId, catalogId, theme, sendDataModel) =>
    set((state) => {
      const next = new Map(state.surfaces);
      next.set(surfaceId, {
        surfaceId,
        catalogId,
        theme: theme ?? {},
        sendDataModel: sendDataModel ?? false,
        components: new Map(),
        dataModel: {},
      });
      return { surfaces: next };
    }),

  updateComponents: (surfaceId, components) =>
    set((state) => {
      const surface = state.surfaces.get(surfaceId);
      if (!surface) return state;

      const nextComponents = new Map(surface.components);
      for (const comp of components) {
        nextComponents.set(comp.id, comp);
      }

      const next = new Map(state.surfaces);
      next.set(surfaceId, { ...surface, components: nextComponents });
      return { surfaces: next };
    }),

  updateDataModel: (surfaceId, path, value) =>
    set((state) => {
      const surface = state.surfaces.get(surfaceId);
      if (!surface) return state;

      const nextDataModel = setPointer(
        surface.dataModel,
        path ?? "/",
        value,
      );

      const next = new Map(state.surfaces);
      next.set(surfaceId, { ...surface, dataModel: nextDataModel });
      return { surfaces: next };
    }),

  deleteSurface: (surfaceId) =>
    set((state) => {
      const next = new Map(state.surfaces);
      next.delete(surfaceId);
      return { surfaces: next };
    }),
}));
