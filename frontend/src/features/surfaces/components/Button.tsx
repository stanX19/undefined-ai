import type { A2UIComponentProps } from "../../a2ui/registry.ts";
import { A2UIRenderer } from "../../a2ui/A2UIRenderer.tsx";

export function A2UIButton({
  definition,
  dataModel,
  components,
  scopePrefix,
}: A2UIComponentProps) {
  const childId = definition.child as string | undefined;
  const isPrimary = definition.variant === "primary" || definition.primary;
  const isSecondary = definition.variant === "secondary";
  const isGhost = definition.variant === "ghost";

  // Shared base
  const base =
    "inline-flex items-center justify-center px-4 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-hover disabled:text-text-muted";

  // Specific variants based on Design System
  let variant = "bg-primary text-white rounded-[24px] shadow-level1 hover:bg-opacity-90 active:scale-95"; // Default primary

  if (isGhost) {
    variant = "bg-transparent text-text-primary hover:bg-ghost-hover rounded-xl";
  } else if (isSecondary) {
    variant = "border border-border bg-surface text-text-primary rounded-xl hover:bg-hover shadow-sm active:scale-[0.98]";
  } else if (isPrimary || definition.primary === undefined) {
    // Treat undefined variant as primary if fallback needed, but respect explicit primary
    variant = "bg-primary text-white rounded-[24px] shadow-level1 hover:bg-opacity-90 active:scale-95 shadow-[0_4px_10px_rgba(17,24,39,0.15)]";
  }

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
