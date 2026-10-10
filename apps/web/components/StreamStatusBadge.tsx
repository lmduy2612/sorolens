"use client";

import type { StreamStatus } from "@/hooks/useEventStream";

export interface StreamStatusBadgeProps {
  status: StreamStatus;
  onReconnect?: () => void;
  lastEventAt?: Date | null;
  className?: string;
}

export function StreamStatusBadge({
  status,
  onReconnect,
  lastEventAt,
  className = "",
}: StreamStatusBadgeProps) {
  const isConnected = status === "connected";
  const isPolling = status === "polling";
  const isReconnecting = status === "reconnecting";
  const isConnecting = status === "connecting";
  const isDisconnected = status === "disconnected";

  const getBadgeStyle = () => {
    if (isConnected)
      return "bg-green-900/40 text-green-400 border-green-800/40";
    if (isPolling) return "bg-amber-900/40 text-amber-400 border-amber-800/40";
    if (isReconnecting)
      return "bg-yellow-900/40 text-yellow-400 border-yellow-800/40";
    if (isConnecting) return "bg-blue-900/40 text-blue-400 border-blue-800/40";
    return "bg-neutral-800/60 text-neutral-400 border-neutral-700/50";
  };

  const getDotStyle = () => {
    if (isConnected) return "bg-green-400 animate-pulse";
    if (isPolling) return "bg-amber-400";
    if (isReconnecting) return "bg-yellow-400 animate-ping";
    if (isConnecting) return "bg-blue-400 animate-pulse";
    return "bg-neutral-500";
  };

  const getLabel = () => {
    if (isConnected) return "Live (SSE)";
    if (isPolling) return "Live (Polling Fallback)";
    if (isReconnecting) return "Reconnecting...";
    if (isConnecting) return "Connecting...";
    return "Disconnected";
  };

  return (
    <div
      className={`inline-flex items-center gap-2 ${className}`}
      data-testid="stream-connection-state"
    >
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${getBadgeStyle()}`}
        data-testid="stream-status-badge"
        title={
          lastEventAt
            ? `Last event: ${lastEventAt.toLocaleTimeString()}`
            : undefined
        }
      >
        <span className={`h-1.5 w-1.5 rounded-full ${getDotStyle()}`} />
        <span data-testid="stream-status-text">{getLabel()}</span>
      </span>

      {(isPolling || isDisconnected || isReconnecting) && onReconnect && (
        <button
          type="button"
          onClick={onReconnect}
          data-testid="stream-reconnect-button"
          aria-label="Reconnect to live stream"
          className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        >
          Reconnect
        </button>
      )}
    </div>
  );
}
