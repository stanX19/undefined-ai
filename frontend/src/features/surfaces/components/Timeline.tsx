import type { A2UIComponentProps } from "../../a2ui/registry.ts";
import { resolvePointer } from "../../a2ui/resolver.ts";

interface TimelineItem {
  title: string;
  description?: string;
  date?: string;
}

export function A2UITimeline({
  definition,
  dataModel,
  scopePrefix,
}: A2UIComponentProps) {
  const rawData = definition.data
    ? typeof definition.data === "object" &&
      definition.data !== null &&
      "path" in (definition.data as Record<string, unknown>)
      ? (resolvePointer(
          dataModel,
          (definition.data as { path: string }).path,
          scopePrefix,
        ) as TimelineItem[])
      : (definition.data as TimelineItem[])
    : undefined;

  if (!Array.isArray(rawData) || rawData.length === 0) {
    return (
      <div className="text-sm text-[var(--color-text-muted)]">
        No timeline data
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      <div className="absolute left-2.5 top-0 h-full w-0.5 bg-[var(--color-border)]" />

      {rawData.map((item, i) => (
        <div key={i} className="relative mb-6 last:mb-0">
          <div className="absolute -left-3.5 top-1.5 h-3 w-3 rounded-full border-2 border-[var(--a2ui-primary,var(--color-primary))] bg-[var(--color-surface)]" />

          <div className="ml-4">
            {item.date && (
              <span className="mb-0.5 block text-xs font-medium text-[var(--color-text-muted)]">
                {item.date}
              </span>
            )}
            <h4 className="text-sm font-semibold">{item.title}</h4>
            {item.description && (
              <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
                {item.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
