import type { A2UIComponentProps } from "../../a2ui/registry.ts";
import { A2UIRenderer } from "../../a2ui/A2UIRenderer.tsx";

export function A2UICard({
  definition,
  dataModel,
  components,
  scopePrefix,
}: A2UIComponentProps) {
  const childId = definition.child as string | undefined;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
      {childId && (
        <A2UIRenderer
          componentId={childId}
          components={components}
          dataModel={dataModel}
          scopePrefix={scopePrefix}
        />
      )}
    </div>
  );
}
