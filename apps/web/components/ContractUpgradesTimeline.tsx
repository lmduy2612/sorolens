"use client";

import { useCallback, useEffect, useState } from "react";
import { getContractUpgrades, getContractVerification } from "@/lib/api";
import type { ContractUpgrade, ContractVerification } from "@/lib/types";
import { VerifiedBadge } from "@/components/VerifiedBadge";

export interface ContractUpgradesTimelineProps {
  contractId: string;
}

function shortHash(h: string): string {
  if (!h) return "—";
  return h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-6)}` : h;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function ContractUpgradesTimeline({
  contractId,
}: ContractUpgradesTimelineProps) {
  const [upgrades, setUpgrades] = useState<ContractUpgrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verification, setVerification] = useState<ContractVerification | null>(
    null
  );

  const fetchUpgradesData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [upgradesRes, verificationRes] = await Promise.allSettled([
        getContractUpgrades(contractId),
        getContractVerification(contractId),
      ]);

      if (upgradesRes.status === "fulfilled") {
        setUpgrades(upgradesRes.value.upgrades ?? []);
      } else {
        throw upgradesRes.reason;
      }

      if (verificationRes.status === "fulfilled") {
        setVerification(verificationRes.value);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load upgrade history."
      );
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    fetchUpgradesData();
  }, [fetchUpgradesData]);

  if (loading) {
    return (
      <div
        data-testid="upgrades-loading"
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 space-y-4 animate-pulse"
      >
        <div className="h-4 w-40 rounded bg-[var(--color-border)]" />
        <div className="space-y-3">
          <div className="h-14 rounded bg-[var(--color-bg-page)]" />
          <div className="h-14 rounded bg-[var(--color-bg-page)]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        data-testid="upgrades-error"
        className="rounded-lg border border-red-500/30 bg-red-950/20 p-5 space-y-3"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-red-400">{error}</span>
          <button
            type="button"
            onClick={fetchUpgradesData}
            className="rounded-md border border-red-500/40 bg-red-950/40 px-3 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-900/40"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (upgrades.length === 0) {
    return (
      <div
        data-testid="upgrades-empty"
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 text-center"
      >
        <p className="text-sm text-[var(--color-text-secondary)]">
          No Wasm hash transitions have been recorded for this contract yet. The
          contract is running its initial deployment.
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="upgrades-timeline"
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6"
    >
      <ol className="relative border-l border-[var(--color-border)] ml-3.5 space-y-6">
        {upgrades.map((u, idx) => {
          const isLatest = idx === 0;
          // Determine verified source reference
          const verifiedRef =
            u.verified_source_ref ||
            (verification?.status === "verified" &&
            (verification.compiled_wasm_hash === u.to_hash ||
              verification.on_chain_hash === u.to_hash)
              ? verification.source?.ref
              : undefined);

          return (
            <li
              key={u.tx_hash || `${u.to_hash}-${u.ledger}`}
              data-testid="upgrade-entry"
              className="ml-6"
            >
              {/* Timeline marker */}
              <span
                className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-[var(--color-bg-card)] ${
                  verifiedRef
                    ? "bg-emerald-400"
                    : isLatest
                      ? "bg-[var(--color-accent)]"
                      : "bg-[var(--color-border)]"
                }`}
                aria-hidden="true"
              />

              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-page)]/50 p-4 transition-colors hover:border-[var(--color-border-hover)]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] pb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[var(--color-text-primary)]">
                      {shortHash(u.to_hash)}
                    </span>
                    {isLatest && (
                      <span className="rounded-full bg-[var(--color-accent)]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">
                        Latest
                      </span>
                    )}
                    {verifiedRef && (
                      <VerifiedBadge
                        sourceRef={verifiedRef}
                        compiledWasmHash={u.to_hash}
                      />
                    )}
                  </div>
                  <time
                    dateTime={u.at}
                    className="text-xs text-[var(--color-text-secondary)] tabular-nums"
                  >
                    {formatDate(u.at)}
                  </time>
                </div>

                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <span className="text-[var(--color-text-secondary)]">
                      From Wasm:{" "}
                    </span>
                    <span className="font-mono text-[var(--color-text-primary)]">
                      {u.from_hash ? shortHash(u.from_hash) : "Initial"}
                    </span>
                  </div>

                  <div>
                    <span className="text-[var(--color-text-secondary)]">
                      Target Wasm:{" "}
                    </span>
                    <span
                      className="font-mono text-[var(--color-text-primary)]"
                      title={u.to_hash}
                    >
                      {u.to_hash}
                    </span>
                  </div>

                  <div>
                    <span className="text-[var(--color-text-secondary)]">
                      Ledger:{" "}
                    </span>
                    <span className="font-mono text-[var(--color-text-primary)] tabular-nums font-medium">
                      #{u.ledger.toLocaleString()}
                    </span>
                  </div>

                  {u.tx_hash && (
                    <div>
                      <span className="text-[var(--color-text-secondary)]">
                        Transaction:{" "}
                      </span>
                      <span
                        className="font-mono text-[var(--color-text-primary)]"
                        title={u.tx_hash}
                      >
                        {shortHash(u.tx_hash)}
                      </span>
                    </div>
                  )}
                </div>

                {verifiedRef && (
                  <div className="mt-3 border-t border-[var(--color-border)] pt-2.5">
                    <a
                      href={verifiedRef}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors"
                      aria-label={`View verified source code for this upgrade at ${verifiedRef} (opens in new tab)`}
                    >
                      <span>Verified source repository / commit</span>
                      <span aria-hidden="true">↗</span>
                    </a>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default ContractUpgradesTimeline;
