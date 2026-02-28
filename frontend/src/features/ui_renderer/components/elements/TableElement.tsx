import { memo } from "react";
import type { UITable } from "../../types.ts";
import { parseSafeStyle, ElementRenderer } from "../ElementRenderer.tsx";

interface TableElementProps {
    element: UITable;
}

export const TableElement = memo(function TableElement({ element }: TableElementProps) {
    const { className, style } = parseSafeStyle(element.style);

    // Create an array of arrays representing the grid
    const rows = Array.from({ length: Math.max(element.total_rows, 1) });
    const cols = Array.from({ length: Math.max(element.total_columns, 1) });

    return (
        <div className={`w-full overflow-x-auto rounded-xl border border-(--color-border) shadow-sm ${className}`} style={style}>
            <table className="w-full text-left text-sm text-(--a2ui-text,var(--color-text-primary))">
                {element.headers && element.headers.length > 0 && (
                    <thead className="bg-(--color-surface-hover) text-xs uppercase text-(--color-text-muted)">
                        <tr>
                            {element.headers.map((headerId, i) => (
                                <th key={i} className="px-6 py-3 font-medium">
                                    <ElementRenderer elementId={headerId} />
                                </th>
                            ))}
                        </tr>
                    </thead>
                )}
                <tbody>
                    {rows.map((_, r) => (
                        <tr key={r} className="border-b border-(--color-border) last:border-b-0 hover:bg-(--color-surface-hover)/50 transition-colors">
                            {cols.map((_, c) => {
                                const cellId = element.cells[`${r}_${c}`];
                                return (
                                    <td key={c} className="px-6 py-4">
                                        {cellId ? <ElementRenderer elementId={cellId} /> : <span className="opacity-50">-</span>}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
});
