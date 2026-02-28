import type { A2UIComponentProps } from "../../a2ui/registry.ts";
import { A2UIRenderer } from "../../a2ui/A2UIRenderer.tsx";

export function A2UICard({
  definition,
  dataModel,
  components,
  scopePrefix,
}: A2UIComponentProps) {
  const childId = definition.child as string | undefined;
  const title = definition.title as string | undefined;
  const isInteractive = !!definition.action;

  const baseClass = "rounded-[24px] border border-border bg-surface shadow-level1 transition-all duration-300 overflow-hidden";
  const interactiveClass = isInteractive ? "hover:shadow-level2 hover:border-primary/30 cursor-pointer" : "";

  const handleClick = () => {
    if (!isInteractive) return;
    const action = definition.action as Record<string, unknown>;
    if (action.event) {
      console.log("[A2UI Action]", action.event);
    }
  };

  return (
    <div className={`${baseClass} ${interactiveClass}`} onClick={handleClick}>
      {title && (
        <div className="px-5 py-3.5 border-b border-border/60 bg-gray-50/40">
          <h2 className="text-[15px] font-semibold text-text-primary tracking-tight">{title}</h2>
        </div>
      )}
      <div className="p-5">
        {childId && (
          <A2UIRenderer
            componentId={childId}
            components={components}
            dataModel={dataModel}
            scopePrefix={scopePrefix}
          />
        )}
      </div>
    </div>
  );
}
