import React from "react";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  accessor?: (item: T) => React.ReactNode;
  sortable?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyState?: React.ReactNode;
  rowKey: (item: T) => string;
  onRowClick?: (item: T) => void;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (columnKey: string) => void;
  className?: string;
  stickyFirstColumn?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  emptyState,
  rowKey,
  onRowClick,
  sortColumn,
  sortDirection,
  onSort,
  className = "",
  stickyFirstColumn = true,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className={`rounded-lg bg-[var(--color-bg-card)] p-4 ${className}`}>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-12 w-full animate-pulse rounded bg-white/5"
            />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>;
  }

  return (
    <div
      className={`rounded-lg bg-[var(--color-bg-card)] overflow-hidden ${className}`}
    >
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-left border-collapse min-w-[360px]">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-xs font-medium text-[var(--color-text-secondary)]">
              {columns.map((col, colIdx) => {
                const isSorted = sortColumn === col.key;
                const isSticky = stickyFirstColumn && colIdx === 0;

                return (
                  <th
                    key={col.key}
                    className={`px-4 py-3 ${
                      isSticky
                        ? "sticky left-0 z-20 bg-[var(--color-bg-card)] shadow-[1px_0_0_0_var(--color-border)]"
                        : ""
                    } ${
                      col.sortable
                        ? "cursor-pointer select-none hover:text-[var(--color-text-primary)]"
                        : ""
                    }`}
                    onClick={() => {
                      if (col.sortable && onSort) {
                        onSort(col.key);
                      }
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span className="text-xs opacity-60">
                          {isSorted
                            ? sortDirection === "asc"
                              ? "▲"
                              : "▼"
                            : "↕"}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr
                key={rowKey(item)}
                onClick={() => onRowClick?.(item)}
                className={`border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-hover)] ${
                  onRowClick ? "cursor-pointer" : ""
                }`}
              >
                {columns.map((col, colIdx) => {
                  const isSticky = stickyFirstColumn && colIdx === 0;

                  return (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-sm ${
                        isSticky
                          ? "sticky left-0 z-10 bg-[var(--color-bg-card)] shadow-[1px_0_0_0_var(--color-border)]"
                          : ""
                      }`}
                    >
                      {col.accessor
                        ? col.accessor(item)
                        : String(
                            (item as Record<string, unknown>)[col.key] ?? "-"
                          )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
