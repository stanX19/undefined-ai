import type { A2UIComponentProps } from "../../a2ui/registry.ts";
import { resolveChildList, resolvePointer } from "../../a2ui/resolver.ts";
import { A2UIRenderer } from "../../a2ui/A2UIRenderer.tsx";

export function A2UIList({
  definition,
  dataModel,
  components,
  scopePrefix,
}: A2UIComponentProps) {
  const children = definition.children;

  // Template-based list (data-bound iteration)
  if (
    children &&
    typeof children === "object" &&
    !Array.isArray(children) &&
    "path" in (children as Record<string, unknown>) &&
    "componentId" in (children as Record<string, unknown>)
  ) {
    const templateDef = children as { path: string; componentId: string };
    const list = resolvePointer(dataModel, templateDef.path, scopePrefix);

    if (!Array.isArray(list)) return null;

    return (
      <div className="flex flex-col gap-2 overflow-y-auto">
        {list.map((_, i) => (
          <A2UIRenderer
            key={i}
            componentId={templateDef.componentId}
            components={components}
            dataModel={dataModel}
            scopePrefix={`${templateDef.path}/${i}`}
          />
        ))}
      </div>
    );
  }

  // Static child list
  const childIds = resolveChildList(children, dataModel, scopePrefix);

  return (
    <div className="flex flex-col gap-2 overflow-y-auto">
      {childIds.map((id) => (
        <A2UIRenderer
          key={id}
          componentId={id}
          components={components}
          dataModel={dataModel}
          scopePrefix={scopePrefix}
        />
      ))}
    </div>
  );
}
