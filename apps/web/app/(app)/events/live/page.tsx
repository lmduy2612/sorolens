"use client";

import { useState } from "react";
import Link from "next/link";
import { EventsTable } from "@/components/EventsTable";
import { StatCard } from "@/components/StatCard";
import { StreamStatusBadge } from "@/components/StreamStatusBadge";
import { useEventStream } from "@/hooks/useEventStream";
import { truncateMiddle } from "@/lib/format";

export default function EventsPage() {
  const [contractIdFilter, setContractIdFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");

  const {
    events,
    setEvents,
    status,
    isConnected,
    isPolling,
    isReconnecting,
    lastEventAt,
    lastEventId,
    reconnect,
  } = useEventStream({
    contractId: activeFilter || undefined,
  });

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveFilter(contractIdFilter.trim());
    setEvents([]);
  };

  const handleClearFilter = () => {
    setContractIdFilter("");
    setActiveFilter("");
    setEvents([]);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Live Events</h1>
            <StreamStatusBadge
              status={status}
              onReconnect={reconnect}
              lastEventAt={lastEventAt}
            />
          </div>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Real-time Server-Sent Events stream as contract events are indexed
            on-chain.{" "}
            <Link
              href="/events"
              className="text-[var(--color-accent)] hover:underline"
            >
              Browse indexed history
            </Link>
          </p>
        </div>

        <form onSubmit={handleApplyFilter} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter by Contract ID..."
            value={contractIdFilter}
            onChange={(e) => setContractIdFilter(e.target.value)}
            className="w-64 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-xs font-mono text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          />
          <button
            type="submit"
            className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-[var(--color-bg-page)] transition-opacity hover:opacity-90"
          >
            Filter
          </button>
          {activeFilter && (
            <button
              type="button"
              onClick={handleClearFilter}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Fallback & Reconnecting Notification Banner (#616) */}
      {isPolling && (
        <div
          data-testid="polling-fallback-banner"
          className="flex items-center justify-between rounded-lg border border-amber-800/40 bg-amber-950/20 px-4 py-3 text-xs text-amber-300"
        >
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span>
              Real-time SSE stream is currently unavailable. Global HTTP polling
              fallback is active to ensure no events are missed.
            </span>
          </div>
          <button
            type="button"
            onClick={reconnect}
            data-testid="banner-reconnect-button"
            className="rounded-md border border-amber-700/60 bg-amber-900/40 px-2.5 py-1 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-800/50"
          >
            Retry Live Stream
          </button>
        </div>
      )}

      {isReconnecting && (
        <div
          data-testid="reconnecting-banner"
          className="flex items-center gap-2 rounded-lg border border-yellow-800/40 bg-yellow-950/20 px-4 py-2.5 text-xs text-yellow-300"
        >
          <span className="h-2 w-2 rounded-full bg-yellow-400 animate-ping" />
          <span>
            Connection interrupted. Resuming stream with Last-Event-ID without
            gaps...
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Streamed Events"
          value={events.length.toLocaleString()}
          subtext={
            activeFilter
              ? `For ${truncateMiddle(activeFilter)}`
              : "Across all tracked contracts"
          }
        />
        <StatCard
          label="Stream Connection"
          value={
            isConnected
              ? "Connected"
              : isPolling
                ? "Polling"
                : isReconnecting
                  ? "Reconnecting"
                  : status === "disconnected"
                    ? "Disconnected"
                    : "Connecting"
          }
          subtext={
            isConnected
              ? "Server-Sent Events active"
              : isPolling
                ? "HTTP polling fallback active"
                : isReconnecting
                  ? "Resuming via Last-Event-ID"
                  : "Establishing connection"
          }
        />
        <StatCard
          label="Last Event Received"
          value={
            lastEventAt
              ? lastEventAt.toLocaleTimeString()
              : "Waiting for events..."
          }
          subtext={
            lastEventId
              ? `Last ID: ${truncateMiddle(lastEventId)}`
              : lastEventAt
                ? lastEventAt.toLocaleDateString()
                : "New events appear in real-time"
          }
        />
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Incoming Event Feed</h2>
          {events.length > 0 && (
            <button
              type="button"
              onClick={() => setEvents([])}
              className="text-xs text-[var(--color-text-secondary)] underline hover:text-[var(--color-text-primary)]"
            >
              Clear feed
            </button>
          )}
        </div>

        <EventsTable events={events} />
      </section>
    </div>
  );
}
