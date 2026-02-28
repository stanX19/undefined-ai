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

  const base =
    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer";
  const variant = isPrimary
    ? "bg-[var(--a2ui-primary,var(--color-primary))] text-white hover:opacity-90 focus:ring-[var(--a2ui-primary,var(--color-primary))]"
    : "border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-alt)]";

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
