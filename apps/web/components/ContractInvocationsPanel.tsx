"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CopyButton, MonoId } from "@sorolens/ui";
import { listInvocations } from "@/lib/api";
import type { Invocation } from "@/lib/types";
import { TableSkeleton } from "@/components/Skeleton";

interface Props {
  contractId: string;
  network?: string;
}

function formatCount(n: number): string {
  return n.toLocaleString();
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function InvocationRow({ invocation }: { invocation: Invocation }) {
  const [expanded, setExpanded] = useState(false);
  const isSuccess = invocation.status === "success";

  const rawJson = JSON.stringify(invocation, null, 2);

  return (
    <>
      <tr
        className="cursor-pointer border-b border-[var(--color-border)] transition-colors hover:bg-white/5"
        onClick={() => setExpanded(!expanded)}
        data-testid={`invocation-row-${invocation.tx_hash}`}
      >
        <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-primary)]">
          {invocation.function_name ? (
            <span className="font-semibold text-[var(--color-accent)]">
              {invocation.function_name}
            </span>
          ) : (
            <span className="text-[var(--color-text-secondary)]">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-xs">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
              isSuccess
                ? "bg-green-900/40 text-green-400"
                : "bg-red-900/40 text-red-400"
            }`}
          >
            {isSuccess ? "Success" : "Failed"}
          </span>
        </td>
        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
          {formatCount(invocation.cpu_insn)}
        </td>
        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
          {formatCount(invocation.mem_byte)} B
        </td>
        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
          {formatCount(invocation.resource_fee_charged)}{" "}
          <span className="text-[10px] text-[var(--color-text-secondary)]">
            stroops
          </span>
        </td>
        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-[var(--color-text-secondary)]">
          {formatCount(invocation.ledger)}
        </td>
        <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">
          {formatTimestamp(invocation.ledger_closed_at)}
        </td>
        <td className="px-4 py-3 font-mono text-xs">
          <MonoId value={invocation.tx_hash} headChars={6} tailChars={6} />
        </td>
        <td className="px-4 py-3 text-right">
          <CopyButton
            text={rawJson}
            label={`Copy details for tx ${invocation.tx_hash}`}
          />
        </td>
      </tr>
      {expanded && (
        <tr className="bg-white/[0.02]">
          <td
            colSpan={9}
            className="border-b border-[var(--color-border)] px-8 py-4"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">
                  Decoded Arguments
                </div>
                <pre className="max-h-60 overflow-x-auto rounded bg-black/20 p-3 font-mono text-xs leading-relaxed text-[var(--color-text-primary)]">
                  {invocation.args_decoded != null
                    ? JSON.stringify(invocation.args_decoded, null, 2)
                    : "None"}
                </pre>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">
                  Decoded Result
                </div>
                <pre className="max-h-60 overflow-x-auto rounded bg-black/20 p-3 font-mono text-xs leading-relaxed text-[var(--color-text-primary)]">
                  {invocation.result_decoded != null
                    ? JSON.stringify(invocation.result_decoded, null, 2)
                    : "None"}
                </pre>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--color-text-secondary)]">
              <span>TX: {invocation.tx_hash}</span>
              <span>
                Ledger I/O: read {formatCount(invocation.ledger_read_byte)} B ·
                write {formatCount(invocation.ledger_write_byte)} B
              </span>
              <span>Network: {invocation.network}</span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function ContractInvocationsPanel({ contractId, network }: Props) {
  const [fnFilter, setFnFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "success" | "failed"
  >("all");
  const [invocations, setInvocations] = useState<Invocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSeq = useRef(0);

  const fetchInvocations = useCallback(
    async (fn: string, status: string, reset: boolean) => {
      const seq = ++loadSeq.current;
      if (reset) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      try {
        const data = await listInvocations({
          contract_id: contractId,
          fn: fn.trim() || undefined,
          status: status === "all" ? undefined : status,
          network,
          limit: 30,
          cursor: reset ? undefined : (cursor ?? undefined),
        });

        if (seq !== loadSeq.current) return;

        setInvocations((prev) =>
          reset ? data.invocations : [...prev, ...data.invocations]
        );
        setCursor(data.next_cursor);
        setHasMore(Boolean(data.next_cursor && data.invocations.length > 0));
      } catch {
        if (seq !== loadSeq.current) return;
        if (reset) {
          setInvocations([]);
          setHasMore(false);
          setError("Failed to load invocations.");
        }
      } finally {
        if (seq === loadSeq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [contractId, network, cursor]
  );

  useEffect(() => {
    void fetchInvocations(fnFilter, statusFilter, true);
  }, [fnFilter, statusFilter, contractId, network]);

  const handleLoadMore = () => {
    if (!cursor || loadingMore) return;
    void fetchInvocations(fnFilter, statusFilter, false);
  };

  const handleClearFilters = () => {
    setFnFilter("");
    setStatusFilter("all");
  };

  const hasActiveFilters = Boolean(fnFilter || statusFilter !== "all");

  return (
    <div className="space-y-4">
      {/* Filters Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="w-full sm:max-w-xs">
            <input
              type="text"
              data-testid="invocations-fn-filter"
              value={fnFilter}
              onChange={(e) => setFnFilter(e.target.value)}
              placeholder="Filter by function name…"
              aria-label="Filter invocations by function name"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3.5 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
          <div className="w-full sm:max-w-[160px]">
            <select
              data-testid="invocations-status-filter"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | "success" | "failed")
              }
              aria-label="Filter invocations by status"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            >
              <option value="all">All statuses</option>
              <option value="success">Success only</option>
              <option value="failed">Failed only</option>
            </select>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              data-testid="invocations-clear-filters"
              onClick={handleClearFilters}
              className="text-xs text-[var(--color-accent)] hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="text-xs text-[var(--color-text-secondary)]">
          {invocations.length > 0 && (
            <span>
              Showing {invocations.length} invocation
              {invocations.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <TableSkeleton rows={6} />
      ) : error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-center text-sm text-red-400">
          {error}
        </div>
      ) : invocations.length === 0 ? (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {hasActiveFilters
              ? "No invocations match the selected filters."
              : "No invocations recorded for this contract yet."}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="mt-3 text-xs font-medium text-[var(--color-accent)] hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table
            className="w-full text-left text-sm"
            data-testid="contract-invocations-table"
          >
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-card)] text-xs text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-4 py-3 font-medium">Function</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">CPU Insn</th>
                <th className="px-4 py-3 text-right font-medium">Memory</th>
                <th className="px-4 py-3 text-right font-medium">
                  Fee Charged
                </th>
                <th className="px-4 py-3 text-right font-medium">Ledger</th>
                <th className="px-4 py-3 font-medium">Timestamp</th>
                <th className="px-4 py-3 font-medium">TX</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {invocations.map((inv) => (
                <InvocationRow
                  key={`${inv.ledger}:${inv.tx_hash}`}
                  invocation={inv}
                />
              ))}
            </tbody>
          </table>

          {hasMore && (
            <div className="border-t border-[var(--color-border)] p-4 text-center">
              <button
                type="button"
                data-testid="load-more-invocations"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
              >
                {loadingMore ? "Loading more…" : "Load more invocations"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
