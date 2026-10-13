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
  getRowHref?: (item: T) => string;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (columnKey: string) => void;
  className?: string;
  caption?: string;
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  emptyState,
  rowKey,
  onRowClick,
  getRowHref,
  sortColumn,
  sortDirection,
  onSort,
  className = "",
  caption,
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
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-[var(--color-border)] text-xs font-medium text-[var(--color-text-secondary)]">
              {columns.map((col) => {
                const isSorted = sortColumn === col.key;
                const ariaSort = col.sortable
                  ? isSorted
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                  : undefined;

                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={ariaSort}
                    className={`px-4 py-3 ${
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
                    {col.sortable ? (
                      <button
                        type="button"
                        className="flex items-center gap-1.5 w-full text-left font-inherit text-inherit focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSort?.(col.key);
                        }}
                        aria-label={`Sort by ${typeof col.header === "string" ? col.header : col.key}`}
                      >
                        <span>{col.header}</span>
                        <span className="text-xs opacity-60" aria-hidden="true">
                          {isSorted
                            ? sortDirection === "asc"
                              ? "▲"
                              : "▼"
                            : "↕"}
                        </span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span>{col.header}</span>
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => {
              const key = rowKey(item);
              const href = getRowHref?.(item);
              const firstLinkColKey = columns.find((c) => c.key !== "select")?.key;

              return (
                <tr
                  key={key}
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? "button" : undefined}
                  onClick={() => onRowClick?.(item)}
                  onKeyDown={(e) => {
                    if (onRowClick && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onRowClick(item);
                    }
                  }}
                  className={`border-b border-[var(--color-border)] transition-colors hover:bg-white/5 focus:outline-none focus-visible:bg-white/10 ${
                    onRowClick ? "cursor-pointer" : ""
                  }`}
                >
                  {columns.map((col) => {
                    const cellContent = col.accessor
                      ? col.accessor(item)
                      : String(
                          (item as Record<string, unknown>)[col.key] ?? "-"
                        );

                    return (
                      <td key={col.key} className="px-4 py-3 text-sm">
                        {href && col.key === firstLinkColKey ? (
                          <a
                            href={href}
                            className="hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] rounded"
                            onClick={(e) => {
                              if (onRowClick) {
                                e.preventDefault();
                                onRowClick(item);
                              }
                            }}
                          >
                            {cellContent}
                          </a>
                        ) : (
                          cellContent
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
}
