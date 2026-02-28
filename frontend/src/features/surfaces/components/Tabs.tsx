import { useState } from "react";
import type { A2UIComponentProps } from "../../a2ui/registry.ts";
import { resolveDynamic } from "../../a2ui/resolver.ts";
import { A2UIRenderer } from "../../a2ui/A2UIRenderer.tsx";

interface TabItem {
  title: string | { literalString: string } | { path: string };
  child: string;
}

export function A2UITabs({
  definition,
  dataModel,
  components,
  scopePrefix,
}: A2UIComponentProps) {
  const tabItems = (definition.tabItems as TabItem[]) ?? [];
  const [activeIndex, setActiveIndex] = useState(0);

  if (tabItems.length === 0) return null;

  return (
    <div>
      <div className="flex border-b border-[var(--color-border)]">
        {tabItems.map((tab, i) => {
          const title = resolveDynamic<string>(tab.title, dataModel, scopePrefix) ?? `Tab ${i + 1}`;
          const isActive = i === activeIndex;

          return (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`cursor-pointer px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border-b-2 border-[var(--a2ui-primary,var(--color-primary))] text-[var(--a2ui-primary,var(--color-primary))]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {title}
            </button>
          );
        })}
      </div>
      <div className="pt-4">
        {tabItems[activeIndex]?.child && (
          <A2UIRenderer
            componentId={tabItems[activeIndex].child}
            components={components}
            dataModel={dataModel}
            scopePrefix={scopePrefix}
          />
        )}
      </div>
    </div>
  );
}
