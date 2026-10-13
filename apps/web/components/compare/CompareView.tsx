"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCompare, listContractsAll } from "@/lib/api";
import type {
  CompareContractEntry,
  ContractSummary,
  TimeWindow,
} from "@/lib/types";
import { ContractSelector } from "./ContractSelector";
import { CompareColumn } from "./CompareColumn";
import { WindowSelector } from "@/components/WindowSelector";

import { isValidContractId } from "@/lib/compare";

const COMPARE_WINDOWS: TimeWindow[] = ["24h", "7d", "30d", "all"];

interface CompareViewProps {
  /** Contract IDs parsed from ?ids= on the server-rendered page. */
  initialIds: string[];
  initialWindow: TimeWindow;
}

/**
 * Client half of the /compare page. It owns the picker state, fetches the
 * unified comparison from GET /api/v1/compare in one round-trip, and mirrors
 * the selection into the URL with router.replace so the view is shareable.
 */
export function CompareView({ initialIds, initialWindow }: CompareViewProps) {
  const router = useRouter();
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>(initialWindow);
  const [entries, setEntries] = useState<CompareContractEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validIds = selectedIds.filter((id) => isValidContractId(id, contracts));
  const invalidIds = selectedIds.filter(
    (id) => !isValidContractId(id, contracts)
  );

  // Tracked contracts that populate the picker.
  useEffect(() => {
    let cancelled = false;
    listContractsAll()
      .then((data) => {
        if (!cancelled) setContracts(data.contracts ?? []);
      })
      .catch(() => {
        if (!cancelled) setContracts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Mirror the selection into the URL so a shared /compare?ids=A,B link stays
  // human-readable: URLSearchParams percent-encodes the comma separator to
  // %2C, so swap it back after serialising. The page parses both identically.
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedIds.length > 0) params.set("ids", selectedIds.join(","));
    if (timeWindow !== "7d") params.set("window", timeWindow);
    const qs = params.toString().replace(/%2C/g, ",");
    router.replace(qs ? `/compare?${qs}` : "/compare", { scroll: false });
  }, [selectedIds, timeWindow, router]);

  // One round-trip for every selected contract.
  useEffect(() => {
    if (validIds.length < 2) {
      setEntries([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getCompare(validIds, timeWindow)
      .then((data) => {
        if (cancelled) return;
        setEntries(data.contracts ?? []);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setEntries([]);
        setError(
          err instanceof Error ? err.message : "Failed to load comparison"
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [validIds.join(","), timeWindow]);

  const columns = entries;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Compare Contracts
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Compare up to 4 contracts side by side across networks. Metrics more
            than 20% worse than the best are highlighted amber, and more than
            50% worse in red.
          </p>
        </div>
        <WindowSelector
          selected={timeWindow}
          onChange={setTimeWindow}
          options={COMPARE_WINDOWS}
        />
      </div>

      <ContractSelector
        selected={selectedIds}
        onSelect={setSelectedIds}
        contracts={contracts}
        max={4}
      />

      {invalidIds.length > 0 && (
        <div
          role="alert"
          data-testid="invalid-ids-alert"
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300"
        >
          <div className="flex items-center gap-2 font-semibold">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Invalid contract ID{invalidIds.length > 1 ? "s" : ""} ignored:
          </div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {invalidIds.map((invId) => (
              <span
                key={invId}
                className="inline-flex items-center gap-1.5 rounded bg-black/40 px-2.5 py-1 font-mono text-xs text-amber-200"
              >
                <span>{invId}</span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedIds(selectedIds.filter((s) => s !== invId))
                  }
                  aria-label={`Remove invalid ID ${invId}`}
                  className="rounded p-0.5 text-amber-400 hover:bg-white/10 hover:text-white"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-amber-300/80">
            Soroban contract IDs must start with &apos;C&apos; and be 56
            uppercase alphanumeric characters.
          </p>
        </div>
      )}

      {error && (
        <div
          className="rounded-lg border border-[var(--color-danger)] bg-[var(--color-bg-card)] px-4 py-3 text-sm text-[var(--color-danger)]"
          role="alert"
        >
          {error}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-xl bg-[var(--color-border)]"
            />
          ))}
        </div>
      )}

      {!loading && validIds.length < 2 && (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-card)] px-8 py-16 text-center">
          <p className="text-lg font-medium text-[var(--color-text-primary)]">
            {selectedIds.length > 0 && invalidIds.length > 0
              ? "Select at least 2 valid contracts to compare"
              : "Select at least 2 contracts to compare"}
          </p>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Pick from the tracked contracts above, or open a shared
            /compare?ids=A,B link directly.
          </p>
        </div>
      )}

      {!loading && !error && columns.length >= 2 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {columns.map((entry) => (
            <CompareColumn key={entry.id} entry={entry} entries={columns} />
          ))}
        </div>
      )}
    </div>
  );
}
