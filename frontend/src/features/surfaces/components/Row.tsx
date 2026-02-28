import type { A2UIComponentProps } from "../../a2ui/registry.ts";
import { resolveChildList } from "../../a2ui/resolver.ts";
import { A2UIRenderer } from "../../a2ui/A2UIRenderer.tsx";

const ALIGN_MAP: Record<string, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};

const DISTRIBUTE_MAP: Record<string, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  spaceBetween: "justify-between",
  spaceAround: "justify-around",
  spaceEvenly: "justify-evenly",
};

export function A2UIRow({
  definition,
  dataModel,
  components,
  scopePrefix,
}: A2UIComponentProps) {
  const childIds = resolveChildList(
    definition.children,
    dataModel,
    scopePrefix,
  );

  const alignment = ALIGN_MAP[(definition.alignment as string) ?? ""] ?? "";
  const distribution =
    DISTRIBUTE_MAP[(definition.distribution as string) ?? ""] ?? "";

  return (
    <div className={`flex gap-3 ${alignment} ${distribution}`.trim()}>
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
