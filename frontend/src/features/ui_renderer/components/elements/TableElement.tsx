import { memo, useMemo } from "react";
import { useUIStore } from "../../store.ts";
import type { UITable, UIText } from "../../types.ts";
import { parseSafeStyle, ElementRenderer } from "../ElementRenderer.tsx";

interface TableElementProps {
    element: UITable;
}

export const TableElement = memo(function TableElement({ element }: TableElementProps) {
    const uiJson = useUIStore((s) => s.uiJson);
    const { className, style } = parseSafeStyle(element.style);

    const rows = Array.from({ length: Math.max(element.total_rows, 0) });
    const cols = Array.from({ length: Math.max(element.total_columns, 0) });

    // Deduplication logic: Check if row 0 data is identical to headers
    const shouldSkipFirstRow = useMemo(() => {
        if (!element.headers || element.headers.length === 0 || !uiJson || element.total_rows === 0) {
            return false;
        }

        const headerLabels = element.headers.map(id => {
            const el = uiJson.elements[id];
            return el?.type === 'text' ? (el as UIText).content.toLowerCase().trim() : null;
        });

        const rowZeroLabels = cols.map((_, c) => {
            const id = element.cells[`0_${c}`];
            const el = uiJson.elements[id];
            return el?.type === 'text' ? (el as UIText).content.toLowerCase().trim() : null;
        });

        return headerLabels.every((label, i) => label !== null && label === rowZeroLabels[i]);
    }, [element, uiJson, cols]);

    const dataRows = shouldSkipFirstRow ? rows.slice(1) : rows;

    return (
        <div className={`w-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-surface shadow-sm transition-all hover:shadow-md ${className}`} style={style}>
            <div className="overflow-x-auto workspace-scrollbar">
                <table className="w-full border-separate border-spacing-0 text-left text-sm">
                    {element.headers && element.headers.length > 0 && (
                        <thead>
                            <tr className="bg-slate-50/80 backdrop-blur-sm">
                                {element.headers.map((headerId, i) => (
                                    <th
                                        key={i}
                                        className="border-b border-[var(--color-border)] px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-slate-400 first:pl-8 last:pr-8"
                                    >
                                        <ElementRenderer elementId={headerId} />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                    )}
                    <tbody className="divide-y divide-[var(--color-border)]">
                        {dataRows.map((_, i) => {
                            const r = shouldSkipFirstRow ? i + 1 : i;
                            return (
                                <tr
                                    key={r}
                                    className="group transition-colors odd:bg-white even:bg-slate-50/10 hover:bg-slate-50/40"
                                >
                                    {cols.map((_, c) => {
                                        const cellId = element.cells[`${r}_${c}`];
                                        return (
                                            <td
                                                key={c}
                                                className="px-6 py-4 text-[13px] leading-relaxed text-slate-600 group-hover:text-slate-900 transition-colors first:pl-8 last:pr-8"
                                            >
                                                {cellId ? (
                                                    <ElementRenderer elementId={cellId} />
                                                ) : (
                                                    <span className="font-light opacity-20">—</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
});
