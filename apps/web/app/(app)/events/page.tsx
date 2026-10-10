"use client";

import {
  Fragment,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { MonoId } from "@sorolens/ui";
import { listAllEvents } from "@/lib/api";
import { networkFilter, useNetwork } from "@/lib/network";
import { TableSkeleton } from "@/components/Skeleton";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import {
  FIRST_PAGE,
  currentCursor,
  dateRangeError,
  dateRangeToBounds,
  formatEventData,
  pageNumber,
  popPage,
  previewEventData,
  pushPage,
  type CursorHistory,
} from "@/lib/eventsExplorer";
import type { EventType, GlobalEvent } from "@/lib/types";

const PAGE_SIZE = 25;

const EVENT_TYPES: { value: "" | EventType; label: string }[] = [
  { value: "", label: "All types" },
  { value: "contract", label: "Contract" },
  { value: "system", label: "System" },
  { value: "diagnostic", label: "Diagnostic" },
];

interface Filters {
  contractId: string;
  type: "" | EventType;
  from: string;
  to: string;
}

const NO_FILTERS: Filters = { contractId: "", type: "", from: "", to: "" };

interface EventUrlFilters extends Record<string, unknown> {
  contractId: string;
  type: "" | EventType;
  from: string;
  to: string;
  cursor: string;
}

const NO_URL_FILTERS: EventUrlFilters = {
  contractId: "",
  type: "",
  from: "",
  to: "",
  cursor: "",
};

const inputClass =
  "rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]";

const buttonClass =
  "rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-40";

function EventRow({ event }: { event: GlobalEvent }) {
  const [expanded, setExpanded] = useState(false);
  const data = event.value_decoded ?? event.value_xdr;
  const closedAt = new Date(event.ledger_closed_at);

  return (
    <>
      <tr className="border-b border-[var(--color-border)] align-top transition-colors hover:bg-white/5">
        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
          <MonoId value={event.contract_id} headChars={6} tailChars={6} />
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-sm">
          <span className="rounded bg-white/5 px-2 py-0.5 text-xs">
            {event.type}
          </span>
        </td>
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="flex max-w-xs items-center gap-2 text-left font-mono text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <span aria-hidden>{expanded ? "▾" : "▸"}</span>
            <span className="truncate">{previewEventData(data)}</span>
          </button>
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-xs text-[var(--color-text-secondary)]">
          {event.ledger.toLocaleString()}
        </td>
        <td
          className="whitespace-nowrap px-4 py-3 text-xs text-[var(--color-text-secondary)]"
          title={event.ledger_closed_at}
        >
          {Number.isNaN(closedAt.getTime()) ? "-" : closedAt.toLocaleString()}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-[var(--color-border)] bg-white/[0.02]">
          <td colSpan={5} className="px-4 py-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">
                  Topics
                </p>
                <pre className="max-h-64 overflow-auto rounded bg-black/30 p-3 font-mono text-xs">
                  {formatEventData(event.topic_decoded ?? event.topic_xdr)}
                </pre>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">
                  Value
                </p>
                <pre className="max-h-64 overflow-auto rounded bg-black/30 p-3 font-mono text-xs">
                  {formatEventData(data)}
                </pre>
              </div>
            </div>
            <p className="mt-2 font-mono text-xs text-[var(--color-text-secondary)]">
              tx <MonoId value={event.tx_hash} headChars={10} tailChars={10} />
              {" · "}
              <Link
                href={`/contracts/${event.contract_id}`}
                className="text-[var(--color-accent)] hover:underline"
              >
                Open contract
              </Link>
            </p>
          </td>
        </tr>
      )}
    </>
  );
}

export default function EventsExplorerPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={8} />}>
      <EventsExplorerInner />
    </Suspense>
  );
}

function EventsExplorerInner() {
  const { network } = useNetwork();
  const { filters: urlFilters, setFilters: setUrlFilters } =
    useUrlFilters<EventUrlFilters>({
      defaultValues: NO_URL_FILTERS,
      parse: (params) => ({
        contractId: (
          params.get("contractId") ||
          params.get("contract_id") ||
          ""
        ).trim(),
        type: (params.get("type") as "" | EventType) || "",
        from: params.get("from") || "",
        to: params.get("to") || "",
        cursor: params.get("cursor") || "",
      }),
    });

  const [draft, setDraft] = useState<Filters>(() => ({
    contractId: urlFilters.contractId,
    type: urlFilters.type,
    from: urlFilters.from,
    to: urlFilters.to,
  }));

  // Sync draft whenever URL filters change (e.g. on Back/Forward)
  useEffect(() => {
    setDraft({
      contractId: urlFilters.contractId,
      type: urlFilters.type,
      from: urlFilters.from,
      to: urlFilters.to,
    });
  }, [urlFilters.contractId, urlFilters.type, urlFilters.from, urlFilters.to]);

  const [history, setHistory] = useState<CursorHistory>(() =>
    urlFilters.cursor ? ["", urlFilters.cursor] : FIRST_PAGE
  );
  const [events, setEvents] = useState<GlobalEvent[]>([]);
  const [nextCursor, setNextCursor] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Sync history when URL cursor changes externally
  useEffect(() => {
    const cur = currentCursor(history);
    if (cur !== urlFilters.cursor) {
      if (!urlFilters.cursor) {
        setHistory(FIRST_PAGE);
      } else {
        const idx = history.indexOf(urlFilters.cursor);
        if (idx !== -1) {
          setHistory(history.slice(0, idx + 1));
        } else {
          setHistory(["", urlFilters.cursor]);
        }
      }
    }
  }, [urlFilters.cursor]);

  const cursor = currentCursor(history);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    listAllEvents(
      {
        cursor: cursor || undefined,
        limit: PAGE_SIZE,
        contractId: urlFilters.contractId || undefined,
        type: urlFilters.type || undefined,
        network: networkFilter(network),
        ...dateRangeToBounds(urlFilters.from, urlFilters.to),
      },
      { signal: controller.signal }
    )
      .then((res) => {
        setEvents(res.events ?? []);
        setNextCursor(res.next_cursor ?? "");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setEvents([]);
        setNextCursor("");
        setError(err instanceof Error ? err.message : "Failed to load events");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [
    cursor,
    urlFilters.contractId,
    urlFilters.type,
    urlFilters.from,
    urlFilters.to,
    network,
    reloadKey,
  ]);

  // A network switch changes the result set, so start from the first page.
  const prevNetwork = useRef(network);
  useEffect(() => {
    if (prevNetwork.current !== network) {
      prevNetwork.current = network;
      setHistory(FIRST_PAGE);
      setUrlFilters((prev) => ({ ...prev, cursor: "" }));
    }
  }, [network, setUrlFilters]);

  const rangeError = dateRangeError(draft.from, draft.to);
  const hasFilters = Boolean(
    urlFilters.contractId || urlFilters.type || urlFilters.from || urlFilters.to
  );

  const applyFilters = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (rangeError) return;
      setHistory(FIRST_PAGE);
      setUrlFilters({
        contractId: draft.contractId.trim(),
        type: draft.type,
        from: draft.from,
        to: draft.to,
        cursor: "",
      });
    },
    [draft, rangeError, setUrlFilters]
  );

  const clearFilters = () => {
    setDraft(NO_FILTERS);
    setHistory(FIRST_PAGE);
    setUrlFilters(NO_URL_FILTERS);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Events</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Every indexed event across all tracked contracts, newest first.
          </p>
        </div>
        <Link
          href="/events/live"
          className="text-sm text-[var(--color-accent)] hover:underline"
        >
          Live stream →
        </Link>
      </div>

      <form
        onSubmit={applyFilters}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4"
        aria-label="Event filters"
      >
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs text-[var(--color-text-secondary)]">
          Contract ID
          <input
            type="search"
            placeholder="C… (full ID or prefix)"
            value={draft.contractId}
            onChange={(e) => setDraft({ ...draft, contractId: e.target.value })}
            className={`${inputClass} font-mono`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-secondary)]">
          Event type
          <select
            value={draft.type}
            onChange={(e) =>
              setDraft({ ...draft, type: e.target.value as Filters["type"] })
            }
            className={inputClass}
          >
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-secondary)]">
          From (UTC)
          <input
            type="date"
            value={draft.from}
            max={draft.to || undefined}
            onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-secondary)]">
          To (UTC)
          <input
            type="date"
            value={draft.to}
            min={draft.from || undefined}
            onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            className={inputClass}
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!!rangeError}
            className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-[var(--color-bg-page)] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Apply
          </button>
          {(hasFilters ||
            JSON.stringify(draft) !== JSON.stringify(NO_FILTERS)) && (
            <button
              type="button"
              onClick={clearFilters}
              className={buttonClass}
            >
              Clear
            </button>
          )}
        </div>
        {rangeError && (
          <p role="alert" className="w-full text-xs text-red-400">
            {rangeError}
          </p>
        )}
      </form>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-900/60 bg-red-950/30 p-6 text-sm"
        >
          <p className="font-medium text-red-300">Couldn&apos;t load events.</p>
          <p className="mt-1 text-[var(--color-text-secondary)]">{error}</p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className={`${buttonClass} mt-4`}
          >
            Try again
          </button>
        </div>
      ) : loading && events.length === 0 ? (
        <TableSkeleton rows={8} />
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] p-10 text-center text-sm text-[var(--color-text-secondary)]">
          {hasFilters ? (
            <>
              <p>No events match these filters.</p>
              <button
                type="button"
                onClick={clearFilters}
                className={`${buttonClass} mt-4`}
              >
                Clear filters
              </button>
            </>
          ) : (
            <p>
              No events indexed yet.{" "}
              <Link
                href="/contracts"
                className="text-[var(--color-accent)] hover:underline"
              >
                Track a contract
              </Link>{" "}
              to start seeing events here.
            </p>
          )}
        </div>
      ) : (
        <div
          className={`overflow-hidden rounded-lg border border-[var(--color-border)] ${loading ? "opacity-60" : ""}`}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="border-b border-[var(--color-border)] text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Contract
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Type
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Data
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Ledger
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <Fragment key={e.id}>
                    <EventRow event={e} />
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!error && (events.length > 0 || pageNumber(history) > 1) && (
        <nav
          className="flex items-center justify-between"
          aria-label="Pagination"
        >
          <button
            type="button"
            onClick={() => {
              const newHist = popPage(history);
              setHistory(newHist);
              setUrlFilters((prev) => ({
                ...prev,
                cursor: currentCursor(newHist),
              }));
            }}
            disabled={loading || pageNumber(history) === 1}
            className={buttonClass}
          >
            ← Previous
          </button>
          <span className="text-xs text-[var(--color-text-secondary)]">
            Page {pageNumber(history)}
          </span>
          <button
            type="button"
            onClick={() => {
              setHistory((h) => pushPage(h, nextCursor));
              setUrlFilters((prev) => ({ ...prev, cursor: nextCursor }));
            }}
            disabled={loading || !nextCursor}
            className={buttonClass}
          >
            Next →
          </button>
        </nav>
      )}
    </div>
  );
}
