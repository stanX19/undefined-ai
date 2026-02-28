import { useSurfaceStore } from "./store.ts";
import { A2UIRenderer } from "./A2UIRenderer.tsx";

interface Props {
  surfaceId: string;
}

/**
 * Renders a single A2UI surface by pulling its state from the store
 * and delegating to the recursive A2UIRenderer starting at "root".
 */
export function SurfaceRenderer({ surfaceId }: Props) {
  const surface = useSurfaceStore((s) => s.surfaces.get(surfaceId));

  if (!surface) return null;
  if (!surface.components.has("root")) {
    return (
      <div className="animate-pulse text-sm text-[var(--color-text-muted)]">
        Loading surface&hellip;
      </div>
    );
  }

  return (
    <div
      className="w-full"
      style={
        surface.theme.primaryColor
          ? ({ "--a2ui-primary": surface.theme.primaryColor } as React.CSSProperties)
          : undefined
      }
    >
      <A2UIRenderer
        componentId="root"
        components={surface.components}
        dataModel={surface.dataModel}
      />
    </div>
  );
}
