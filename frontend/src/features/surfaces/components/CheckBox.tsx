import { useState, useEffect } from "react";
import type { A2UIComponentProps } from "../../a2ui/registry.ts";
import { resolveDynamic } from "../../a2ui/resolver.ts";
import { useSurfaceStore } from "../../a2ui/store.ts";

export function A2UICheckBox({
  definition,
  dataModel,
  scopePrefix,
}: A2UIComponentProps) {
  const label = resolveDynamic<string>(
    definition.label as string | { literalString: string } | { path: string },
    dataModel,
    scopePrefix,
  );

  const boundPath =
    typeof definition.value === "object" &&
    definition.value !== null &&
    "path" in (definition.value as Record<string, unknown>)
      ? (definition.value as { path: string }).path
      : undefined;

  const initial = resolveDynamic<boolean>(
    definition.value as boolean | { path: string } | undefined,
    dataModel,
    scopePrefix,
  ) ?? false;

  const [checked, setChecked] = useState(initial);

  useEffect(() => {
    setChecked(initial);
  }, [initial]);

  const handleChange = () => {
    const next = !checked;
    setChecked(next);

    if (boundPath) {
      const surfaces = useSurfaceStore.getState().surfaces;
      for (const [surfaceId, surface] of surfaces) {
        if (surface.components.has(definition.id)) {
          useSurfaceStore.getState().updateDataModel(surfaceId, boundPath, next);
          break;
        }
      }
    }
  };

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={handleChange}
        className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--a2ui-primary,var(--color-primary))]"
      />
      {label}
    </label>
  );
}
