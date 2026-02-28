import type { A2UIComponentProps } from "../../a2ui/registry.ts";
import { resolvePointer } from "../../a2ui/resolver.ts";

interface TableData {
  headers: string[];
  rows: (string | number)[][];
}

export function A2UIDataTable({
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
        ) as TableData)
      : (definition.data as TableData)
    : undefined;

  if (!rawData?.headers || !rawData?.rows) {
    return (
      <div className="text-sm text-[var(--color-text-muted)]">
        No table data
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-alt)]">
            {rawData.headers.map((h, i) => (
              <th key={i} className="px-4 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rawData.rows.map((row, ri) => (
            <tr
              key={ri}
              className="border-b border-[var(--color-border)] last:border-b-0"
            >
              {row.map((cell, ci) => (
                <td key={ci} className="px-4 py-2.5">
                  {String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
