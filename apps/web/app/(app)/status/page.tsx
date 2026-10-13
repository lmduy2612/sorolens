"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fetchSystemStatus, type SystemStatusData } from "@/lib/status";
import { formatClockTime } from "@/lib/lastUpdated";

const DEFAULT_REFRESH_INTERVAL = 15_000; // 15 seconds

export default function StatusPage() {
  const [data, setData] = useState<SystemStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(
    DEFAULT_REFRESH_INTERVAL
  );

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchSystemStatus();
      setData(res);
    } catch {
      // In case of total network failure
      setData((prev) =>
        prev
          ? { ...prev, overallStatus: "outage", checkedAt: Date.now() }
          : null
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return;
    const timer = setInterval(() => {
      loadStatus();
    }, refreshInterval);
    return () => clearInterval(timer);
  }, [autoRefresh, refreshInterval, loadStatus]);

  const overall = data?.overallStatus ?? "operational";

  return (
    <div className="space-y-8">
      {/* Header and Auto-refresh controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
            System Status
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Real-time health, build metadata, and indexer lag across all
            networks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-0"
            />
            Auto-refresh
          </label>

          {autoRefresh && (
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              aria-label="Refresh interval"
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2.5 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none"
            >
              <option value={10000}>10s</option>
              <option value={15000}>15s</option>
              <option value={30000}>30s</option>
              <option value={60000}>60s</option>
            </select>
          )}

          <button
            type="button"
            onClick={loadStatus}
            disabled={loading}
            aria-label="Refresh now"
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-border)] disabled:opacity-50"
          >
            {loading ? "Checking…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Overall Banner */}
      <div
        data-testid="status-banner"
        className={`rounded-lg p-5 border text-center transition-colors ${
          overall === "operational"
            ? "border-green-500/40 bg-green-950/20 text-green-400"
            : overall === "degraded"
              ? "border-yellow-500/40 bg-yellow-950/20 text-yellow-400"
              : "border-red-500/40 bg-red-950/20 text-red-400"
        }`}
      >
        <div className="flex items-center justify-center gap-2">
          <span
            className={`inline-block h-3 w-3 rounded-full ${
              overall === "operational"
                ? "bg-green-400"
                : overall === "degraded"
                  ? "bg-yellow-400"
                  : "bg-red-400"
            }`}
          />
          <h2 className="text-lg font-semibold capitalize">
            {overall === "operational"
              ? "All Systems Operational"
              : overall === "degraded"
                ? "Degraded Performance"
                : "Partial Service Outage"}
          </h2>
        </div>
        {data && (
          <p className="mt-1 text-xs opacity-80 tabular-nums">
            Last checked at{" "}
            <time dateTime={new Date(data.checkedAt).toISOString()}>
              {formatClockTime(data.checkedAt)}
            </time>
          </p>
        )}
      </div>

      {/* Grid: Health Checks & Version Info */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* API Health & Readiness */}
        <div
          data-testid="health-section"
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              API &amp; Readiness Checks
            </h3>
            {data?.health ? (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium uppercase ${
                  data.health.status === "ok"
                    ? "bg-green-900/40 text-green-400"
                    : "bg-yellow-900/40 text-yellow-400"
                }`}
              >
                {data.health.status}
              </span>
            ) : null}
          </div>

          {data?.healthError ? (
            <div
              role="alert"
              className="rounded-md border border-red-500/30 bg-red-950/20 p-3 text-xs text-red-400"
            >
              {data.healthError}
            </div>
          ) : data?.health ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <dt className="text-[var(--color-text-secondary)]">
                  Database (PostgreSQL)
                </dt>
                <dd className="flex items-center gap-1.5 font-medium">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      data.health.db === "connected"
                        ? "bg-green-400"
                        : "bg-red-400"
                    }`}
                  />
                  <span
                    className={
                      data.health.db === "connected"
                        ? "text-green-400 capitalize"
                        : "text-red-400 capitalize"
                    }
                  >
                    {data.health.db}
                  </span>
                </dd>
              </div>

              <div className="flex justify-between items-center">
                <dt className="text-[var(--color-text-secondary)]">
                  Cache (Redis)
                </dt>
                <dd className="flex items-center gap-1.5 font-medium">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      data.health.redis === "connected"
                        ? "bg-green-400"
                        : "bg-red-400"
                    }`}
                  />
                  <span
                    className={
                      data.health.redis === "connected"
                        ? "text-green-400 capitalize"
                        : "text-red-400 capitalize"
                    }
                  >
                    {data.health.redis}
                  </span>
                </dd>
              </div>

              <div className="flex justify-between items-center">
                <dt className="text-[var(--color-text-secondary)]">
                  Server Time
                </dt>
                <dd className="font-mono text-xs tabular-nums text-[var(--color-text-primary)]">
                  {new Date(data.health.timestamp).toUTCString()}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="h-20 animate-pulse rounded bg-[var(--color-bg-page)]" />
          )}
        </div>

        {/* Version & Build Metadata */}
        <div
          data-testid="version-section"
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              Build Metadata
            </h3>
            {data?.version ? (
              <span className="font-mono text-xs text-[var(--color-accent)]">
                v{data.version.version}
              </span>
            ) : null}
          </div>

          {data?.versionError ? (
            <div
              role="alert"
              className="rounded-md border border-red-500/30 bg-red-950/20 p-3 text-xs text-red-400"
            >
              {data.versionError}
            </div>
          ) : data?.version ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <dt className="text-[var(--color-text-secondary)]">
                  Semantic Version
                </dt>
                <dd className="font-mono text-xs text-[var(--color-text-primary)] font-medium">
                  {data.version.version}
                </dd>
              </div>

              <div className="flex justify-between items-center">
                <dt className="text-[var(--color-text-secondary)]">
                  Git Commit
                </dt>
                <dd className="font-mono text-xs text-[var(--color-text-primary)]">
                  {data.version.git_sha}
                </dd>
              </div>

              <div className="flex justify-between items-center">
                <dt className="text-[var(--color-text-secondary)]">Built At</dt>
                <dd className="font-mono text-xs tabular-nums text-[var(--color-text-primary)]">
                  {data.version.built_at === "dev"
                    ? "dev build"
                    : new Date(data.version.built_at).toLocaleString()}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="h-20 animate-pulse rounded bg-[var(--color-bg-page)]" />
          )}
        </div>
      </div>

      {/* Indexer Progress & Lag */}
      <section
        data-testid="indexer-section"
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 space-y-4"
      >
        <div className="flex flex-col gap-1 border-b border-[var(--color-border)] pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              Indexer Lag &amp; Progress
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Latest committed ledger cursor vs network head ledger sequence.
            </p>
          </div>
          {data?.indexerError && (
            <span role="alert" className="text-xs text-yellow-400 font-medium">
              Metrics partially unavailable
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table
            className="min-w-full text-left text-sm"
            data-testid="indexer-table"
          >
            <thead className="text-xs text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
              <tr>
                <th className="py-2.5 px-3 font-medium">Network</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
                <th className="py-2.5 px-3 font-medium">Last Indexed Ledger</th>
                <th className="py-2.5 px-3 font-medium">Head Ledger</th>
                <th className="py-2.5 px-3 font-medium">Lag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] font-mono text-xs">
              {data?.indexer.map((item) => (
                <tr
                  key={item.network}
                  className="transition-colors hover:bg-[var(--color-bg-page)]/40"
                >
                  <td className="py-3 px-3 font-sans font-medium text-[var(--color-text-primary)] capitalize">
                    {item.network}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-sans font-medium capitalize ${
                        item.status === "synced"
                          ? "bg-green-900/40 text-green-400"
                          : item.status === "lagging"
                            ? "bg-yellow-900/40 text-yellow-400"
                            : item.status === "degraded"
                              ? "bg-red-900/40 text-red-400"
                              : "bg-gray-800 text-[var(--color-text-secondary)]"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 tabular-nums text-[var(--color-text-primary)]">
                    {item.last_indexed_ledger !== null
                      ? item.last_indexed_ledger.toLocaleString()
                      : "—"}
                  </td>
                  <td className="py-3 px-3 tabular-nums text-[var(--color-text-secondary)]">
                    {item.head_ledger !== null
                      ? item.head_ledger.toLocaleString()
                      : "—"}
                  </td>
                  <td className="py-3 px-3 tabular-nums font-semibold">
                    {item.lag_ledgers !== null ? (
                      <span
                        className={
                          item.lag_ledgers > 50
                            ? "text-red-400"
                            : item.lag_ledgers > 10
                              ? "text-yellow-400"
                              : "text-green-400"
                        }
                      >
                        {item.lag_ledgers}{" "}
                        {item.lag_ledgers === 1 ? "ledger" : "ledgers"}
                      </span>
                    ) : (
                      <span className="text-[var(--color-text-secondary)]">
                        —
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Useful Links / Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--color-border)] p-4 text-xs text-[var(--color-text-secondary)]">
        <div>
          <span>Need historical SLA reports? </span>
          <Link
            href="/watchdog/reports"
            className="text-[var(--color-accent)] underline underline-offset-2 hover:opacity-80"
          >
            Visit SLA Reports →
          </Link>
        </div>
        <div>
          <span>Real-time contract anomalies: </span>
          <Link
            href="/watchdog"
            className="text-[var(--color-accent)] underline underline-offset-2 hover:opacity-80"
          >
            Watchdog Monitor →
          </Link>
        </div>
      </div>
    </div>
  );
}
