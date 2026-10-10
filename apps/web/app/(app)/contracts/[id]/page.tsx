"use client";

import { Suspense, use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  notFound,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { MonoId } from "@sorolens/ui";
import {
  getContract,
  getContractEvents,
  getContractStorage,
  getContractStats,
  addContractTag,
  removeContractTag,
  ApiError,
} from "@/lib/api";
import type {
  ContractDetail,
  ContractEvent,
  StorageEntry,
  StatsResponse,
  ResourceTrendPoint,
  TimeWindow,
} from "@/lib/types";
import { getUserId } from "@/lib/user";
import { StatCard } from "@/components/StatCard";
import { TagInput } from "@/components/TagInput";
import {
  CardSkeleton,
  ChartSkeleton,
  TableSkeleton,
} from "@/components/Skeleton";
import { WindowSelector } from "@/components/WindowSelector";
import { EventVolumeChart } from "@/components/EventVolumeChart";
import { InvocationChart } from "@/components/InvocationChart";
import { getResourceTrend } from "@/lib/resourceTrend";
import { EventsTable } from "@/components/EventsTable";
import { StoragePanel } from "@/components/StoragePanel";
import { ContractNotesPanel } from "@/components/ContractNotesPanel";
import { SnapshotPanel } from "@/components/SnapshotPanel";
import { HealthScoreCard } from "@/components/HealthScoreCard";
import { AddToGroup } from "@/components/AddToGroup";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { CallTracePanel } from "@/components/CallTracePanel";
import { useEventStream } from "@/hooks/useEventStream";
import { ContractInvocationsPanel } from "@/components/ContractInvocationsPanel";
import { ContractWatchdogPanel } from "@/components/ContractWatchdogPanel";

interface Props {
  params: Promise<{ id: string }>;
}

const CONTRACT_TABS = [
  { id: "overview", label: "Overview" },
  { id: "events", label: "Events" },
  { id: "invocations", label: "Invocations" },
  { id: "storage", label: "Storage" },
  { id: "watchdog", label: "Watchdog" },
] as const;

type ContractTabId = (typeof CONTRACT_TABS)[number]["id"];

function isValidTab(t: string | null | undefined): t is ContractTabId {
  return CONTRACT_TABS.some((tab) => tab.id === t);
}

export default function ContractDetailPage({ params }: Props) {
  const { id } = use(params);
  return (
    <Suspense fallback={null}>
      <ContractDetailContent id={id} />
    </Suspense>
  );
}

function ContractDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabParam = searchParams?.get("tab");
  const [activeTab, setActiveTab] = useState<ContractTabId>(() =>
    isValidTab(tabParam) ? tabParam : "overview"
  );

  const handleTabChange = useCallback(
    (tab: ContractTabId) => {
      setActiveTab(tab);
      const sp = new URLSearchParams(searchParams?.toString() ?? "");
      if (tab === "overview") {
        sp.delete("tab");
      } else {
        sp.set("tab", tab);
      }
      const qs = sp.toString();
      const basePath =
        pathname ||
        (typeof window !== "undefined" ? window.location?.pathname : "") ||
        "";
      const targetUrl = qs ? `?${qs}` : basePath;
      router.replace(targetUrl, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  // Sync tab on searchParams changes
  useEffect(() => {
    const t = searchParams?.get("tab");
    if (isValidTab(t)) {
      setActiveTab(t);
    } else if (!t) {
      setActiveTab("overview");
    }
  }, [searchParams]);

  // Sync tab on popstate (browser back/forward navigation)
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.addEventListener !== "function"
    ) {
      return;
    }
    const handlePopState = () => {
      const searchStr =
        window.location.search || searchParams?.toString() || "";
      const sp = new URLSearchParams(searchStr);
      const t = sp.get("tab");
      setActiveTab(isValidTab(t) ? t : "overview");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [searchParams]);

  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [contractError, setContractError] = useState<string | null>(null);
  const [contractLoading, setContractLoading] = useState(true);

  // User-defined tags are edited inline on this page.
  const [tags, setTags] = useState<string[]>([]);
  const [tagError, setTagError] = useState<string | null>(null);
  const [tagSaving, setTagSaving] = useState(false);

  const [timeWindow, setTimeWindow] = useState<TimeWindow>("7d");
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [trend, setTrend] = useState<ResourceTrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);

  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsCursor, setEventsCursor] = useState<string | null>(null);
  const [eventsHasMore, setEventsHasMore] = useState(false);
  const [showFailedOnly, setShowFailedOnly] = useState(false);

  const [storage, setStorage] = useState<StorageEntry[]>([]);
  const [storageLoading, setStorageLoading] = useState(true);
  const [storageCursor, setStorageCursor] = useState<string | null>(null);
  const [storageHasMore, setStorageHasMore] = useState(false);
  const [currentLedger, setCurrentLedger] = useState(0);

  const { isConnected: isStreamConnected } = useEventStream({
    contractId: id,
    onEvent: (newEvent) => {
      setEvents((prev) => {
        if (prev.some((e) => e.id === newEvent.id)) return prev;
        return [newEvent, ...prev];
      });
    },
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getContract(id);
        if (!cancelled) {
          setContract(data);
          setTags(data.tags ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError && err.status === 404) {
            notFound();
          }
          setContractError("Contract not found");
        }
      } finally {
        if (!cancelled) setContractLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      setStatsLoading(true);
      try {
        const data = await getContractStats(id, timeWindow);
        if (!cancelled) setStats(data);
      } catch {
        // stats are non-critical
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    }

    loadStats();
    return () => {
      cancelled = true;
    };
  }, [id, timeWindow]);

  useEffect(() => {
    let cancelled = false;

    async function loadTrend() {
      setTrendLoading(true);
      try {
        const data = await getResourceTrend(id, 30);
        if (!cancelled) setTrend(data);
      } catch {
        // non-critical
      } finally {
        if (!cancelled) setTrendLoading(false);
      }
    }

    loadTrend();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setEventsLoading(true);
      try {
        const data = await getContractEvents(id, {
          limit: 50,
          in_successful_call: showFailedOnly ? false : undefined,
        });
        if (!cancelled) {
          setEvents(data.events);
          setEventsCursor(data.cursor);
          setEventsHasMore(data.has_more);
        }
      } catch {
        // non-critical
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    }

    loadEvents();
    return () => {
      cancelled = true;
    };
  }, [id, showFailedOnly]);

  useEffect(() => {
    let cancelled = false;

    async function loadStorage() {
      setStorageLoading(true);
      try {
        const data = await getContractStorage(id, { limit: 100 });
        if (!cancelled) {
          setStorage(data.entries);
          setStorageCursor(data.cursor);
          setStorageHasMore(data.has_more);
          setCurrentLedger(data.current_ledger);
        }
      } catch {
        // non-critical
      } finally {
        if (!cancelled) setStorageLoading(false);
      }
    }

    loadStorage();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleLoadMoreEvents = useCallback(async () => {
    if (!eventsCursor) return;
    try {
      const data = await getContractEvents(id, {
        cursor: eventsCursor,
        limit: 50,
        in_successful_call: showFailedOnly ? false : undefined,
      });
      setEvents((prev) => [...prev, ...data.events]);
      setEventsCursor(data.cursor);
      setEventsHasMore(data.has_more);
    } catch {
      // non-critical
    }
  }, [id, eventsCursor, showFailedOnly]);

  const handleLoadMoreStorage = useCallback(async () => {
    if (!storageCursor) return;
    try {
      const data = await getContractStorage(id, {
        cursor: storageCursor,
        limit: 100,
      });
      setStorage((prev) => [...prev, ...data.entries]);
      setStorageCursor(data.cursor);
      setStorageHasMore(data.has_more);
    } catch {
      // non-critical
    }
  }, [id, storageCursor]);

  const handleAddTag = useCallback(
    async (tag: string) => {
      setTagSaving(true);
      setTagError(null);
      try {
        const res = await addContractTag(id, tag, getUserId());
        setTags(res.tags ?? []);
      } catch (err) {
        setTagError(
          err instanceof ApiError && err.status === 401
            ? "You need a contributor identity to edit tags."
            : "Failed to add tag."
        );
      } finally {
        setTagSaving(false);
      }
    },
    [id]
  );

  const handleRemoveTag = useCallback(
    async (tag: string) => {
      setTagSaving(true);
      setTagError(null);
      try {
        await removeContractTag(id, tag, getUserId());
        setTags((prev) => prev.filter((t) => t !== tag));
      } catch (err) {
        setTagError(
          err instanceof ApiError && err.status === 401
            ? "You need a contributor identity to edit tags."
            : "Failed to remove tag."
        );
      } finally {
        setTagSaving(false);
      }
    },
    [id]
  );

  if (contractLoading) {
    return (
      <div>
        <header className="mb-8">
          <SkeletonHeader />
        </header>
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
        <TableSkeleton />
      </div>
    );
  }

  if (contractError) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-8 py-16 text-center">
        <p className="text-lg font-medium text-[var(--color-text-primary)]">
          {contractError}
        </p>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Check the contract ID and try again, or return to the{" "}
          <Link
            href="/contracts"
            className="text-[var(--color-accent)] underline underline-offset-2 hover:opacity-80"
          >
            contracts list
          </Link>
          .
        </p>
      </div>
    );
  }

  const eventVolumeData = stats?.event_volume ?? [];
  const invocationData = stats?.invocation_count ?? [];
  const contractStats = stats?.stats;

  return (
    <div>
      <header className="mb-6">
        <div className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">
          Contract
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">
              <MonoId value={id} headChars={8} tailChars={8} />
            </h1>
            {contract?.label && (
              <span className="text-lg text-[var(--color-text-secondary)]">
                {contract.label}
              </span>
            )}
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                contract?.status === "active"
                  ? "bg-green-900/40 text-green-400"
                  : contract?.status === "backfilling"
                    ? "bg-blue-900/40 text-blue-400"
                    : contract?.status === "error"
                      ? "bg-red-900/40 text-red-400"
                      : "bg-yellow-900/40 text-yellow-400"
              }`}
            >
              {contract?.status}
            </span>
            <AddToGroup contractId={id} />
            <VerifiedBadge contractId={id} />
          </div>

          {/* Cross-links to Compare and Watchdog (#617) */}
          <div
            className="flex items-center gap-2"
            data-testid="contract-cross-links"
          >
            <Link
              href={`/compare?ids=${encodeURIComponent(id)}`}
              data-testid="link-compare"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)]"
            >
              Compare
            </Link>
            <Link
              href={`/watchdog/${encodeURIComponent(id)}`}
              data-testid="link-watchdog"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)]"
            >
              Watchdog
            </Link>
          </div>
        </div>

        {contract?.sync && (
          <div className="mt-1 flex gap-4 text-xs text-[var(--color-text-secondary)]">
            <span>Network: {contract.network}</span>
            <span>
              Last ledger: {contract.sync.last_ledger.toLocaleString()}
            </span>
            <span>
              Last sync: {new Date(contract.sync.last_run_at).toLocaleString()}
            </span>
          </div>
        )}
        <div className="mt-3 max-w-lg">
          <TagInput
            tags={tags}
            onAdd={handleAddTag}
            onRemove={handleRemoveTag}
            disabled={tagSaving}
            error={tagError}
            placeholder="Add a tag (prod, staging…)"
          />
        </div>
      </header>

      {/* Accessible & Deep-linkable Tabs Navigation (#617) */}
      <div className="mb-6 border-b border-[var(--color-border)]">
        <nav
          className="-mb-px flex space-x-2 overflow-x-auto"
          role="tablist"
          aria-label="Contract navigation"
        >
          {CONTRACT_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => handleTabChange(tab.id)}
                data-testid={`tab-${tab.id}`}
                className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                    : "border-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Panels */}
      <div
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={0}
        className="focus:outline-none"
      >
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-8" data-testid="panel-overview">
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Events"
                value={contractStats?.total_events?.toLocaleString() ?? "-"}
                subtext="Total indexed"
              />
              <StatCard
                label="Invocations"
                value={
                  contractStats?.total_invocations?.toLocaleString() ?? "-"
                }
                subtext="Total transactions"
              />
              <StatCard
                label="Storage Entries"
                value={
                  contractStats?.storage_entry_count?.toLocaleString() ?? "-"
                }
                subtext="Currently tracked"
              />
              <StatCard
                label="Expiring Soon"
                value={
                  contractStats?.expiring_entry_count?.toLocaleString() ?? "-"
                }
                subtext="Within 7 days"
                variant={
                  (contractStats?.expiring_entry_count ?? 0) > 10
                    ? "danger"
                    : (contractStats?.expiring_entry_count ?? 0) > 0
                      ? "warning"
                      : "default"
                }
              />
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Activity</h2>
                <WindowSelector
                  selected={timeWindow}
                  onChange={setTimeWindow}
                />
              </div>
              {statsLoading ? (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <ChartSkeleton />
                  <ChartSkeleton />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-lg bg-[var(--color-bg-card)] p-4">
                    <h3 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">
                      Event Volume
                    </h3>
                    <EventVolumeChart data={eventVolumeData} />
                  </div>
                  <div className="rounded-lg bg-[var(--color-bg-card)] p-4">
                    <h3 className="mb-3 text-sm font-medium text-[var(--color-text-secondary)]">
                      Invocations
                    </h3>
                    <InvocationChart data={invocationData} />
                  </div>
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-4 text-xl font-semibold">Call trace</h2>
              <CallTracePanel initialTxHash={events[0]?.tx_hash} />
            </section>

            <section>
              <h2 className="mb-4 text-xl font-semibold">Notes</h2>
              <ContractNotesPanel contractId={id} />
            </section>

            <section>
              <h2 className="mb-4 text-xl font-semibold">Snapshot / replay</h2>
              <SnapshotPanel contractId={id} currentLedger={currentLedger} />
            </section>

            <section>
              <HealthScoreCard contractId={id} />
            </section>
          </div>
        )}

        {/* EVENTS TAB */}
        {activeTab === "events" && (
          <div className="space-y-4" data-testid="panel-events">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">Events</h2>
                {isStreamConnected && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-900/40 px-2.5 py-0.5 text-xs font-medium text-green-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                    Live
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowFailedOnly(!showFailedOnly)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  showFailedOnly
                    ? "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                    : "bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                Failed Only
              </button>
            </div>
            {eventsLoading ? (
              <TableSkeleton />
            ) : (
              <EventsTable
                events={events}
                onLoadMore={handleLoadMoreEvents}
                hasMore={eventsHasMore}
              />
            )}
          </div>
        )}

        {/* INVOCATIONS TAB (#617) */}
        {activeTab === "invocations" && (
          <div className="space-y-4" data-testid="panel-invocations">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Invocations</h2>
            </div>
            <ContractInvocationsPanel
              contractId={id}
              network={contract?.network}
            />
          </div>
        )}

        {/* STORAGE TAB */}
        {activeTab === "storage" && (
          <div className="space-y-4" data-testid="panel-storage">
            <h2 className="text-xl font-semibold">Storage TTL</h2>
            {storageLoading ? (
              <TableSkeleton />
            ) : (
              <StoragePanel
                entries={storage}
                currentLedger={currentLedger}
                onLoadMore={handleLoadMoreStorage}
                hasMore={storageHasMore}
              />
            )}
          </div>
        )}

        {/* WATCHDOG TAB (#617) */}
        {activeTab === "watchdog" && (
          <div className="space-y-4" data-testid="panel-watchdog">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Watchdog Monitoring</h2>
            </div>
            <ContractWatchdogPanel contractId={id} />
          </div>
        )}
      </div>
    </div>
  );
}

function SkeletonHeader() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-3 w-16 rounded bg-[var(--color-border)]" />
      <div className="flex items-center gap-3">
        <div className="h-8 w-48 rounded bg-[var(--color-border)]" />
        <div className="h-5 w-16 rounded-full bg-[var(--color-border)]" />
      </div>
      <div className="flex gap-4">
        <div className="h-3 w-32 rounded bg-[var(--color-border)]" />
        <div className="h-3 w-28 rounded bg-[var(--color-border)]" />
        <div className="h-3 w-36 rounded bg-[var(--color-border)]" />
      </div>
    </div>
  );
}
