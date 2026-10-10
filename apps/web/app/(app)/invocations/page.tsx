"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { DataTable, MonoId } from "@sorolens/ui";
import type { Column } from "@sorolens/ui";
import { listInvocations } from "@/lib/api";
import type { Invocation } from "@/lib/types";
import { networkFilter, useNetwork } from "@/lib/network";
import { TableSkeleton } from "@/components/Skeleton";
import { useUrlFilters } from "@/hooks/useUrlFilters";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

interface Filters {
  contractId: string;
  fn: string;
  since: string;
  until: string;
}

const EMPTY_FILTERS: Filters = { contractId: "", fn: "", since: "", until: "" };

interface InvocationsUrlFilters extends Record<string, unknown> {
  contractId: string;
  fn: string;
  since: string;
  until: string;
  sort: string;
  dir: "asc" | "desc";
  cursor: string;
}

const DEFAULT_INVOCATIONS_URL: InvocationsUrlFilters = {
  contractId: "",
  fn: "",
  since: "",
  until: "",
  sort: "ledger_closed_at",
  dir: "desc",
  cursor: "",
};

function hasActiveFilters(f: Filters): boolean {
  return Boolean(f.contractId || f.fn || f.since || f.until);
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCount(n: number): string {
  return n.toLocaleString();
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

const COLUMNS: Column<Invocation>[] = [
  {
    key: "contract_id",
    header: "Contract ID",
    accessor: (inv) => (
      <span className="font-mono text-xs">
        <MonoId value={inv.contract_id} headChars={8} tailChars={8} />
      </span>
    ),
  },
  {
    key: "function_name",
    header: "Function Name",
    accessor: (inv) =>
      inv.function_name ? (
        <span className="font-mono text-xs text-[var(--color-text-primary)]">
          {inv.function_name}
        </span>
      ) : (
        <span className="text-[var(--color-text-secondary)]">--</span>
      ),
  },
  {
    key: "cpu_insn",
    header: "CPU Instructions",
    sortable: true,
    accessor: (inv) => (
      <span className="tabular-nums">{formatCount(inv.cpu_insn)}</span>
    ),
  },
  {
    key: "mem_byte",
    header: "Memory Bytes",
    accessor: (inv) => (
      <span className="tabular-nums">{formatCount(inv.mem_byte)}</span>
    ),
  },
  {
    key: "ledger_io",
    header: "Ledger I/O",
    accessor: (inv) => {
      const total = inv.ledger_read_byte + inv.ledger_write_byte;
      return (
        <span
          className="tabular-nums"
          title={`read ${formatCount(inv.ledger_read_byte)} B · write ${formatCount(inv.ledger_write_byte)} B`}
        >
          {formatCount(total)} B
        </span>
      );
    },
  },
  {
    key: "resource_fee_charged",
    header: "Fee Charged",
    sortable: true,
    accessor: (inv) => (
      <span className="tabular-nums">
        {formatCount(inv.resource_fee_charged)}
        <span className="ml-1 text-xs text-[var(--color-text-secondary)]">
          stroops
        </span>
      </span>
    ),
  },
  {
    key: "ledger",
    header: "Ledger",
    accessor: (inv) => (
      <span className="tabular-nums">{formatCount(inv.ledger)}</span>
    ),
  },
  {
    key: "ledger_closed_at",
    header: "Timestamp",
    sortable: true,
    accessor: (inv) => (
      <span className="text-xs text-[var(--color-text-secondary)]">
        {formatTimestamp(inv.ledger_closed_at)}
      </span>
    ),
  },
];

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function InvocationsPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={PAGE_SIZE} />}>
      <InvocationsPageInner />
    </Suspense>
  );
}

function InvocationsPageInner() {
  const { network } = useNetwork();

  const { filters: urlFilters, setFilters: setUrlFilters } =
    useUrlFilters<InvocationsUrlFilters>({
      defaultValues: DEFAULT_INVOCATIONS_URL,
      parse: (sp) => ({
        contractId: (
          sp.get("contractId") ||
          sp.get("contract_id") ||
          ""
        ).trim(),
        fn: (sp.get("fn") || "").trim(),
        since: sp.get("since") || "",
        until: sp.get("until") || "",
        sort: sp.get("sort") || "ledger_closed_at",
        dir: sp.get("dir") === "asc" ? "asc" : "desc",
        cursor: sp.get("cursor") || "",
      }),
    });

  // Data state
  const [invocations, setInvocations] = useState<Invocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Pagination: stack of cursors, index 0 is the first page.
  const [cursors, setCursors] = useState<(string | null)[]>(() =>
    urlFilters.cursor ? [null, urlFilters.cursor] : [null]
  );
  const [cursorIndex, setCursorIndex] = useState(() =>
    urlFilters.cursor ? 1 : 0
  );
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Filter inputs (draft)
  const [draft, setDraft] = useState<Filters>(() => ({
    contractId: urlFilters.contractId,
    fn: urlFilters.fn,
    since: urlFilters.since,
    until: urlFilters.until,
  }));

  // Sync draft when URL filters change (e.g. Back/Forward)
  useEffect(() => {
    setDraft({
      contractId: urlFilters.contractId,
      fn: urlFilters.fn,
      since: urlFilters.since,
      until: urlFilters.until,
    });
  }, [
    urlFilters.contractId,
    urlFilters.fn,
    urlFilters.since,
    urlFilters.until,
  ]);

  // Sync cursor stack when URL cursor changes externally
  useEffect(() => {
    const cur = cursors[cursorIndex] ?? "";
    if (cur !== urlFilters.cursor) {
      if (!urlFilters.cursor) {
        setCursors([null]);
        setCursorIndex(0);
      } else {
        const idx = cursors.indexOf(urlFilters.cursor);
        if (idx !== -1) {
          setCursorIndex(idx);
        } else {
          setCursors([null, urlFilters.cursor]);
          setCursorIndex(1);
        }
      }
    }
  }, [urlFilters.cursor]);

  // Only the most recent load may write to state.
  const loadSeq = useRef(0);

  const load = useCallback(
    async (cursor: string | null) => {
      const seq = ++loadSeq.current;
      setLoading(true);
      try {
        const data = await listInvocations({
          cursor: cursor ?? undefined,
          limit: PAGE_SIZE,
          contract_id: urlFilters.contractId || undefined,
          fn: urlFilters.fn || undefined,
          since: urlFilters.since || undefined,
          until: urlFilters.until || undefined,
          network: networkFilter(network),
        });
        if (seq !== loadSeq.current) return;
        setInvocations(data.invocations ?? []);
        setNextCursor(data.next_cursor || null);
        setError(false);
      } catch {
        if (seq !== loadSeq.current) return;
        setInvocations([]);
        setNextCursor(null);
        setError(true);
      } finally {
        if (seq === loadSeq.current) setLoading(false);
      }
    },
    [
      urlFilters.contractId,
      urlFilters.fn,
      urlFilters.since,
      urlFilters.until,
      network,
    ]
  );

  useEffect(() => {
    load(cursors[cursorIndex]);
  }, [load, cursors, cursorIndex]);

  // Reset to the first page when the global network selector changes.
  const prevNetwork = useRef(network);
  useEffect(() => {
    if (prevNetwork.current !== network) {
      prevNetwork.current = network;
      setCursors([null]);
      setCursorIndex(0);
      setUrlFilters((prev) => ({ ...prev, cursor: "" }));
    }
  }, [network, setUrlFilters]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    setCursors([null]);
    setCursorIndex(0);
    setUrlFilters((prev) => ({
      ...prev,
      contractId: draft.contractId.trim(),
      fn: draft.fn.trim(),
      since: draft.since,
      until: draft.until,
      cursor: "",
    }));
  };

  const handleClear = () => {
    setDraft(EMPTY_FILTERS);
    setCursors([null]);
    setCursorIndex(0);
    setUrlFilters((prev) => ({
      ...prev,
      contractId: "",
      fn: "",
      since: "",
      until: "",
      cursor: "",
    }));
  };

  const handleNext = () => {
    if (!nextCursor) return;
    const newCursors = [...cursors.slice(0, cursorIndex + 1), nextCursor];
    setCursors(newCursors);
    setCursorIndex(cursorIndex + 1);
    setUrlFilters((prev) => ({ ...prev, cursor: nextCursor }));
  };

  const handlePrev = () => {
    if (cursorIndex === 0) return;
    const nextIdx = cursorIndex - 1;
    setCursorIndex(nextIdx);
    const prevCur = cursors[nextIdx] ?? "";
    setUrlFilters((prev) => ({ ...prev, cursor: prevCur }));
  };

  const handleSort = (col: string) => {
    let nextDir: "asc" | "desc" = "asc";
    if (col === urlFilters.sort) {
      nextDir = urlFilters.dir === "asc" ? "desc" : "asc";
    }
    setUrlFilters((prev) => ({ ...prev, sort: col, dir: nextDir }), {
      mode: "replace",
    });
  };

  // ---------------------------------------------------------------------------
  // Derived: sorted view of the current page
  // ---------------------------------------------------------------------------

  const sorted = [...invocations].sort((a, b) => {
    let cmp = 0;
    switch (urlFilters.sort) {
      case "cpu_insn":
        cmp = a.cpu_insn - b.cpu_insn;
        break;
      case "resource_fee_charged":
        cmp = a.resource_fee_charged - b.resource_fee_charged;
        break;
      default:
        cmp =
          new Date(a.ledger_closed_at).getTime() -
          new Date(b.ledger_closed_at).getTime();
    }
    if (cmp === 0) cmp = a.tx_hash.localeCompare(b.tx_hash);
    return urlFilters.dir === "asc" ? cmp : -cmp;
  });

  const filtersActive = Boolean(
    urlFilters.contractId ||
    urlFilters.fn ||
    urlFilters.since ||
    urlFilters.until
  );
  const isFirstPage = cursorIndex === 0;
  const isLastPage = !nextCursor;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
          Invocations
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Resource usage (CPU, memory, ledger I/O and fees) for every invocation
          across all tracked contracts.
        </p>
      </div>

      {/* Filters */}
      <form
        onSubmit={handleApply}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4"
      >
        <div className="flex flex-col gap-1">
          <label
            htmlFor="invocations-contract-filter"
            className="text-xs font-medium text-[var(--color-text-secondary)]"
          >
            Contract ID
          </label>
          <input
            id="invocations-contract-filter"
            type="text"
            value={draft.contractId}
            onChange={(e) =>
              setDraft((d) => ({ ...d, contractId: e.target.value }))
            }
            placeholder="C…"
            spellCheck={false}
            className="w-56 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-page)] px-3 py-1.5 font-mono text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="invocations-fn-filter"
            className="text-xs font-medium text-[var(--color-text-secondary)]"
          >
            Function name
          </label>
          <input
            id="invocations-fn-filter"
            type="text"
            value={draft.fn}
            onChange={(e) => setDraft((d) => ({ ...d, fn: e.target.value }))}
            placeholder="transfer"
            spellCheck={false}
            className="w-40 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-page)] px-3 py-1.5 font-mono text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="invocations-since-filter"
            className="text-xs font-medium text-[var(--color-text-secondary)]"
          >
            From date
          </label>
          <input
            id="invocations-since-filter"
            type="date"
            value={draft.since}
            onChange={(e) => setDraft((d) => ({ ...d, since: e.target.value }))}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-page)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="invocations-until-filter"
            className="text-xs font-medium text-[var(--color-text-secondary)]"
          >
            To date
          </label>
          <input
            id="invocations-until-filter"
            type="date"
            value={draft.until}
            onChange={(e) => setDraft((d) => ({ ...d, until: e.target.value }))}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-page)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            id="invocations-apply-filter"
            type="submit"
            className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-[var(--color-bg-page)] transition-opacity hover:opacity-90"
          >
            Apply
          </button>
          {filtersActive && (
            <button
              id="invocations-clear-filter"
              type="button"
              onClick={handleClear}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {/* Loading skeleton */}
      {loading && <TableSkeleton rows={PAGE_SIZE} />}

      {/* Empty state */}
      {!loading && sorted.length === 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-8 py-16 text-center">
          <p className="text-lg font-medium text-[var(--color-text-primary)]">
            {filtersActive
              ? "No invocations match your filters"
              : error
                ? "Could not load invocations"
                : "No invocations indexed yet"}
          </p>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {filtersActive
              ? "Try widening the date range or clearing the contract and function filters."
              : error
                ? "The API could not be reached. Check NEXT_PUBLIC_API_URL and try Apply again."
                : "Invocations appear here once the indexer has traced activity for tracked contracts."}
          </p>
        </div>
      )}

      {/* Data table */}
      {!loading && sorted.length > 0 && (
        <DataTable<Invocation>
          columns={COLUMNS}
          data={sorted}
          rowKey={(inv) => `${inv.ledger}:${inv.tx_hash}`}
          sortColumn={urlFilters.sort}
          sortDirection={urlFilters.dir}
          onSort={handleSort}
          onRowClick={(inv) => {
            window.location.href = `/contracts/${inv.contract_id}`;
          }}
          emptyState={
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-8 py-12 text-center text-sm text-[var(--color-text-secondary)]">
              No invocations match your filters.
            </div>
          }
        />
      )}

      {/* Pagination */}
      {!loading && invocations.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-secondary)]">
            Page {cursorIndex + 1}
            {urlFilters.sort !== "ledger_closed_at" && (
              <span className="ml-2 opacity-80">
                (sorting applies to the current page)
              </span>
            )}
          </span>
          <div className="flex gap-2">
            <button
              id="invocations-prev-page"
              type="button"
              onClick={handlePrev}
              disabled={isFirstPage}
              aria-label="Previous page"
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Previous
            </button>
            <button
              id="invocations-next-page"
              type="button"
              onClick={handleNext}
              disabled={isLastPage}
              aria-label="Next page"
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
