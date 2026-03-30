import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";

export function TableShell({
  columns,
  rows,
  emptyTitle = "Nothing here yet",
  emptyDescription = "This table is waiting for real data once the underlying domain model is implemented.",
}: Readonly<{
  columns: string[];
  rows: Array<{
    id: string;
    cells: ReactNode[];
  }>;
  emptyTitle?: string;
  emptyDescription?: string;
}>) {
  if (rows.length === 0) {
    return (
      <EmptyState
        eyebrow="Table"
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.7rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] shadow-innerline">
      <div className="scrollbar-subtle overflow-x-auto">
        <table className="min-w-full divide-y divide-white/8">
          <thead className="bg-white/[0.03]">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-6 py-4 text-left text-[0.7rem] font-medium uppercase tracking-[0.22em] text-muted"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-white/8">
            {rows.map((row) => (
              <tr key={row.id} className="transition hover:bg-white/[0.035]">
                {row.cells.map((cell, index) => (
                  <td key={`${row.id}-${index}`} className="px-6 py-5 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
