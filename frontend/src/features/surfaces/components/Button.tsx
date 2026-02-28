import type { A2UIComponentProps } from "../../a2ui/registry.ts";
import { A2UIRenderer } from "../../a2ui/A2UIRenderer.tsx";

export function A2UIButton({
  definition,
  dataModel,
  components,
  scopePrefix,
}: A2UIComponentProps) {
  const childId = definition.child as string | undefined;
  const isPrimary =
    (definition.primary as boolean) ?? definition.variant === "primary";

  // Shared base
  const base =
    "inline-flex items-center justify-center px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer disabled:cursor-not-allowed disabled:bg-hover disabled:text-text-muted";

  // Specific variants based on Design System
  const variant = isPrimary
    ? "bg-sidebar text-white rounded-3xl shadow-level1 hover:bg-opacity-90 focus:ring-primary"
    : "border border-border bg-surface text-text-primary rounded-xl hover:bg-hover";

  const handleClick = () => {
    const action = definition.action as Record<string, unknown> | undefined;
    if (!action) return;

    if (action.event) {
      const event = action.event as { name: string; context?: Record<string, unknown> };
      console.log("[A2UI Action]", event.name, event.context);
    }
  };

  return (
    <button className={`${base} ${variant}`} onClick={handleClick}>
      {childId ? (
        <A2UIRenderer
          componentId={childId}
          components={components}
          dataModel={dataModel}
          scopePrefix={scopePrefix}
        />
      ) : (
        (definition.text as string) ?? "Button"
      )}
    </button>
  );
}
