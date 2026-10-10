"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getMonitoredContract,
  getContractUptime,
  listHealthChecks,
  listAlerts,
  ApiError,
} from "@/lib/api";
import type {
  ContractAlert,
  HealthCheck,
  MonitoredContract,
  UptimeWindow,
} from "@/lib/types";
import { CardSkeleton, TableSkeleton } from "@/components/Skeleton";
import {
  HealthBadge,
  SeverityBadge,
  UptimeBadge,
} from "@/components/WatchdogBadges";
import { WatchdogTimeline } from "@/components/WatchdogTimeline";

interface Props {
  contractId: string;
}

const UPTIME_WINDOWS: UptimeWindow[] = ["24h", "7d", "30d"];

export function ContractWatchdogPanel({ contractId }: Props) {
  const [monitored, setMonitored] = useState<MonitoredContract | null>(null);
  const [checks, setChecks] = useState<HealthCheck[] | null>(null);
  const [alerts, setAlerts] = useState<ContractAlert[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNotMonitored, setIsNotMonitored] = useState(false);

  // Uptime state (null = loading, number = percentage)
  const [uptime24h, setUptime24h] = useState<number | null>(null);
  const [uptime7d, setUptime7d] = useState<number | null>(null);
  const [uptime30d, setUptime30d] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setIsNotMonitored(false);
      try {
        const c = await getMonitoredContract(contractId);
        if (cancelled) return;
        setMonitored(c);

        // Fetch health checks, uptime, and alerts in parallel
        void listHealthChecks(contractId, 30)
          .then((res) => {
            if (!cancelled) setChecks(res.health_checks);
          })
          .catch(() => {
            if (!cancelled) setChecks([]);
          });

        void listAlerts(undefined, { limit: 10 })
          .then((res) => {
            if (!cancelled) {
              const contractAlerts = res.alerts.filter(
                (a) => a.contract_id === contractId
              );
              setAlerts(contractAlerts);
            }
          })
          .catch(() => {
            if (!cancelled) setAlerts([]);
          });

        for (const w of UPTIME_WINDOWS) {
          void getContractUptime(contractId, w)
            .then((res) => {
              if (cancelled) return;
              if (w === "24h") setUptime24h(res.uptime_pct);
              if (w === "7d") setUptime7d(res.uptime_pct);
              if (w === "30d") setUptime30d(res.uptime_pct);
            })
            .catch(() => {
              if (cancelled) return;
              if (w === "24h") setUptime24h(null);
              if (w === "7d") setUptime7d(null);
              if (w === "30d") setUptime30d(null);
            });
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setIsNotMonitored(true);
        } else {
          setIsNotMonitored(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [contractId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <TableSkeleton rows={4} />
      </div>
    );
  }

  if (isNotMonitored || !monitored) {
    return (
      <div
        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 text-center"
        data-testid="watchdog-unmonitored-state"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-xl text-[var(--color-accent)]">
          🛡️
        </div>
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Watchdog Monitoring
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-text-secondary)]">
          This contract is not currently enrolled in active Watchdog monitoring.
          Track automated health checks, uptime SLAs, response latency, and
          receive real-time anomaly alerts.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href={`/watchdog/${encodeURIComponent(contractId)}`}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-bg-page)] hover:opacity-90"
            data-testid="watchdog-setup-btn"
          >
            Configure in Watchdog →
          </Link>
          <Link
            href="/watchdog"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            View all monitored contracts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="watchdog-panel-content">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <div className="text-xs text-[var(--color-text-secondary)]">
            Status
          </div>
          <div className="mt-2 flex items-center gap-2">
            <HealthBadge status={monitored.status} />
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Network: {monitored.network}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <div className="text-xs text-[var(--color-text-secondary)]">
            24h Uptime
          </div>
          <div className="mt-2">
            <UptimeBadge pct={uptime24h} window="24h" />
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Last 24 hours
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <div className="text-xs text-[var(--color-text-secondary)]">
            7d Uptime
          </div>
          <div className="mt-2">
            <UptimeBadge pct={uptime7d} window="7d" />
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Last 7 days
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <div className="text-xs text-[var(--color-text-secondary)]">
            30d Uptime
          </div>
          <div className="mt-2">
            <UptimeBadge pct={uptime30d} window="30d" />
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Last 30 days
          </div>
        </div>
      </div>

      {/* Timeline Section */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Health Check History
          </h3>
          <Link
            href={`/watchdog/${encodeURIComponent(contractId)}`}
            className="text-xs font-medium text-[var(--color-accent)] hover:underline"
            data-testid="watchdog-detail-link"
          >
            Full watchdog view →
          </Link>
        </div>
        {checks && checks.length > 0 ? (
          <WatchdogTimeline checks={checks} />
        ) : (
          <p className="py-4 text-center text-xs text-[var(--color-text-secondary)]">
            No health checks recorded yet.
          </p>
        )}
      </div>

      {/* Alerts Section */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Recent Alerts
          </h3>
          {alerts && alerts.length > 0 && (
            <span className="text-xs text-[var(--color-text-secondary)]">
              {alerts.length} alert{alerts.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {alerts && alerts.length > 0 ? (
          <div className="space-y-2">
            {alerts.map((alert, idx) => (
              <div
                key={alert.tx_hash || `${alert.timestamp}-${idx}`}
                className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-black/10 px-4 py-2.5 text-xs"
              >
                <div className="flex items-center gap-3">
                  <SeverityBadge severity={alert.severity} />
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {alert.message}
                  </span>
                </div>
                <span className="text-[var(--color-text-secondary)]">
                  {new Date(alert.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-2 text-xs text-[var(--color-text-secondary)]">
            No active alerts for this contract. All systems operational.
          </p>
        )}
      </div>
    </div>
  );
}
