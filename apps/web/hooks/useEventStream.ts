"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ContractEvent } from "@/lib/types";
import { getContractEvents, listAllEvents } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface UseEventStreamOptions {
  contractId?: string;
  enabled?: boolean;
  pollFallbackInterval?: number; // fallback polling interval in ms, default 5000
  maxRetries?: number; // max consecutive SSE errors before polling fallback, default 3
  onEvent?: (event: ContractEvent) => void;
  onAlert?: (alert: unknown) => void;
}

export type StreamStatus =
  "connecting" | "connected" | "reconnecting" | "polling" | "disconnected";

export function useEventStream(
  contractIdOrOptions?: string | UseEventStreamOptions
) {
  const options =
    typeof contractIdOrOptions === "string"
      ? { contractId: contractIdOrOptions }
      : contractIdOrOptions || {};

  const {
    contractId,
    enabled = true,
    pollFallbackInterval = 5000,
    maxRetries = 3,
    onEvent,
    onAlert,
  } = options;

  const [events, setEvents] = useState<ContractEvent[]>([]);
  const [status, setStatus] = useState<StreamStatus>("disconnected");
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);

  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onAlertRef = useRef(onAlert);
  onAlertRef.current = onAlert;

  const failureCountRef = useRef(0);
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastEventIdRef = useRef<string | null>(null);
  const hasConnectedOnceRef = useRef(false);
  const isCancelledRef = useRef(false);

  const addEvent = useCallback((event: ContractEvent) => {
    setEvents((prev) => {
      // De-duplicate if event already in list
      if (prev.some((e) => e.id === event.id)) {
        return prev;
      }
      return [event, ...prev];
    });
    setLastEventAt(new Date());
    lastEventIdRef.current = event.id;
    if (onEventRef.current) {
      onEventRef.current(event);
    }
  }, []);

  // Backfill missed events from API after reconnect to ensure no gaps
  const backfillMissedEvents = useCallback(async () => {
    if (!lastEventIdRef.current || isCancelledRef.current) return;
    try {
      if (contractId) {
        const data = await getContractEvents(contractId, { limit: 50 });
        if (!isCancelledRef.current && data.events) {
          data.events.forEach((ev) => addEvent(ev));
        }
      } else {
        const data = await listAllEvents({ limit: 50 });
        if (!isCancelledRef.current && data.events) {
          data.events.forEach((ev) => addEvent(ev));
        }
      }
    } catch {
      // non-critical, live stream continues
    }
  }, [contractId, addEvent]);

  // Start HTTP polling fallback (supports both contract-scoped and global streams)
  const startPollingFallback = useCallback(() => {
    if (isCancelledRef.current) return;
    setStatus("polling");

    async function poll() {
      if (isCancelledRef.current) return;
      try {
        if (contractId) {
          const data = await getContractEvents(contractId, { limit: 20 });
          if (!isCancelledRef.current && data.events) {
            data.events.forEach((ev) => addEvent(ev));
          }
        } else {
          // Global polling fallback (#616)
          const data = await listAllEvents({ limit: 20 });
          if (!isCancelledRef.current && data.events) {
            data.events.forEach((ev) => addEvent(ev));
          }
        }
      } catch {
        // ignore polling errors
      }
    }

    // Run immediate poll, then schedule periodic interval
    void poll();
    if (fallbackTimerRef.current) {
      clearInterval(fallbackTimerRef.current);
    }
    fallbackTimerRef.current = setInterval(poll, pollFallbackInterval);
  }, [contractId, pollFallbackInterval, addEvent]);

  // Establish SSE connection
  const connectSSE = useCallback(() => {
    if (isCancelledRef.current) return;

    // Clean up existing EventSource or polling timer
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (fallbackTimerRef.current) {
      clearInterval(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }

    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      startPollingFallback();
      return;
    }

    const searchParams = new URLSearchParams();
    if (contractId) {
      searchParams.set("contract_id", contractId);
    }
    // Send Last-Event-ID on reconnect as query param (#616)
    if (lastEventIdRef.current) {
      searchParams.set("last_event_id", lastEventIdRef.current);
    }
    const qs = searchParams.toString();
    const url = `${API_URL}/api/v1/stream/events${qs ? "?" + qs : ""}`;

    setStatus(hasConnectedOnceRef.current ? "reconnecting" : "connecting");
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      if (isCancelledRef.current) return;
      const wasReconnecting =
        hasConnectedOnceRef.current && !!lastEventIdRef.current;
      hasConnectedOnceRef.current = true;
      failureCountRef.current = 0;
      setStatus("connected");

      if (fallbackTimerRef.current) {
        clearInterval(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }

      // Resume without gaps by fetching any events that arrived while disconnected (#616)
      if (wasReconnecting) {
        void backfillMissedEvents();
      }
    };

    es.onmessage = (e) => {
      if (isCancelledRef.current) return;
      try {
        const data = JSON.parse(e.data);
        if (data.type === "event" && data.event) {
          addEvent(data.event);
        } else if (data.type === "alert" && data.alert) {
          if (onAlertRef.current) {
            onAlertRef.current(data.alert);
          }
        }
      } catch {
        // non-JSON message / ping, keep alive
      }
    };

    es.onerror = () => {
      if (isCancelledRef.current) return;
      failureCountRef.current += 1;

      // If SSE repeatedly errors, fallback to polling
      if (failureCountRef.current >= maxRetries && !fallbackTimerRef.current) {
        es.close();
        eventSourceRef.current = null;
        startPollingFallback();
      } else {
        setStatus("reconnecting");
      }
    };
  }, [
    contractId,
    maxRetries,
    addEvent,
    backfillMissedEvents,
    startPollingFallback,
  ]);

  // Explicit reconnect trigger (e.g. for user UI or recovery)
  const reconnect = useCallback(() => {
    failureCountRef.current = 0;
    connectSSE();
  }, [connectSSE]);

  useEffect(() => {
    if (!enabled) {
      setStatus("disconnected");
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (fallbackTimerRef.current) {
        clearInterval(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      return;
    }

    isCancelledRef.current = false;
    connectSSE();

    return () => {
      isCancelledRef.current = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (fallbackTimerRef.current) {
        clearInterval(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      setStatus("disconnected");
    };
  }, [enabled, connectSSE]);

  return {
    events,
    setEvents,
    status,
    isConnected: status === "connected",
    isPolling: status === "polling",
    isReconnecting: status === "reconnecting",
    isConnecting: status === "connecting" || status === "reconnecting",
    lastEventAt,
    lastEventId: lastEventIdRef.current,
    reconnect,
  };
}
