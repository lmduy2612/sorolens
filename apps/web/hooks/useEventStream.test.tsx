import { renderHook, act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEventStream } from "./useEventStream";
import type { ContractEvent, GlobalEvent } from "@/lib/types";

// ── Mock API ─────────────────────────────────────────────────────────────────
const mockGetContractEvents = vi.fn();
const mockListAllEvents = vi.fn();

vi.mock("@/lib/api", () => ({
  getContractEvents: (...args: unknown[]) => mockGetContractEvents(...args),
  listAllEvents: (...args: unknown[]) => mockListAllEvents(...args),
}));

// ── Mock EventSource ─────────────────────────────────────────────────────────
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 0;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  simulateOpen() {
    this.readyState = 1;
    this.onopen?.();
  }

  simulateMessage(data: unknown) {
    this.onmessage?.(
      new MessageEvent("message", { data: JSON.stringify(data) })
    );
  }

  simulateError() {
    this.onerror?.();
  }

  close = vi.fn(() => {
    this.readyState = 2;
  });
}

const SAMPLE_EVENT_1: ContractEvent = {
  id: "evt-001",
  contract_id: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  network: "testnet",
  ledger: 100,
  ledger_closed_at: "2026-10-10T12:00:00Z",
  tx_hash: "tx-001",
  type: "contract",
  topic_decoded: ["transfer"],
  topic_xdr: ["AAAAAQ=="],
  value_decoded: 100,
  value_xdr: "AAAAZA==",
  in_successful_call: true,
};

const SAMPLE_EVENT_2: ContractEvent = {
  id: "evt-002",
  contract_id: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  network: "testnet",
  ledger: 101,
  ledger_closed_at: "2026-10-10T12:01:00Z",
  tx_hash: "tx-002",
  type: "contract",
  topic_decoded: ["mint"],
  topic_xdr: ["AAAAAg=="],
  value_decoded: 250,
  value_xdr: "AAABGQ==",
  in_successful_call: true,
};

const SAMPLE_EVENT_3: GlobalEvent = {
  id: "evt-003",
  contract_id: "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
  network: "mainnet",
  ledger: 200,
  ledger_closed_at: "2026-10-10T12:05:00Z",
  tx_hash: "tx-003",
  type: "contract",
  topic_decoded: ["swap"],
  topic_xdr: ["AAAAAw=="],
  value_decoded: 50,
  value_xdr: "AAAA2g==",
  in_successful_call: true,
};

describe("useEventStream (#616)", () => {
  const originalEventSource = globalThis.EventSource;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    MockEventSource.instances = [];
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.EventSource = originalEventSource;
  });

  it("establishes SSE connection and updates state on open and message", () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() =>
      useEventStream({
        contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        onEvent,
      })
    );

    expect(MockEventSource.instances).toHaveLength(1);
    const es = MockEventSource.instances[0];
    expect(es.url).toContain(
      "contract_id=CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    );
    expect(es.url).not.toContain("last_event_id");
    expect(result.current.status).toBe("connecting");

    // Open connection
    act(() => {
      es.simulateOpen();
    });
    expect(result.current.status).toBe("connected");
    expect(result.current.isConnected).toBe(true);
    expect(result.current.isPolling).toBe(false);

    // Receive first event
    act(() => {
      es.simulateMessage({ type: "event", event: SAMPLE_EVENT_1 });
    });

    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].id).toBe("evt-001");
    expect(result.current.lastEventId).toBe("evt-001");
    expect(result.current.lastEventAt).toBeInstanceOf(Date);
    expect(onEvent).toHaveBeenCalledWith(SAMPLE_EVENT_1);
  });

  it("de-duplicates identical events by id", () => {
    const { result } = renderHook(() => useEventStream());
    const es = MockEventSource.instances[0];

    act(() => {
      es.simulateOpen();
      es.simulateMessage({ type: "event", event: SAMPLE_EVENT_1 });
      es.simulateMessage({ type: "event", event: SAMPLE_EVENT_1 });
    });

    expect(result.current.events).toHaveLength(1);
  });

  it("forwards alert messages to onAlert callback", () => {
    const onAlert = vi.fn();
    renderHook(() => useEventStream({ onAlert }));
    const es = MockEventSource.instances[0];

    act(() => {
      es.simulateOpen();
      es.simulateMessage({
        type: "alert",
        alert: { message: "High latency detected" },
      });
    });

    expect(onAlert).toHaveBeenCalledWith({ message: "High latency detected" });
  });

  it("falls back to global polling with listAllEvents when contractId is omitted (#616)", async () => {
    mockListAllEvents.mockResolvedValue({
      events: [SAMPLE_EVENT_3],
      next_cursor: "",
    });

    const { result } = renderHook(() =>
      useEventStream({
        maxRetries: 3,
        pollFallbackInterval: 3000,
      })
    );

    const es = MockEventSource.instances[0];

    // Trigger 3 consecutive errors
    act(() => {
      es.simulateError();
      es.simulateError();
      es.simulateError();
    });

    expect(result.current.status).toBe("polling");
    expect(result.current.isPolling).toBe(true);
    expect(result.current.isConnected).toBe(false);
    expect(es.close).toHaveBeenCalled();

    // Verify global fallback was called
    await waitFor(() => {
      expect(mockListAllEvents).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 20 })
      );
    });

    // Advance timer to trigger next poll interval
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockListAllEvents).toHaveBeenCalledTimes(2);
    expect(mockGetContractEvents).not.toHaveBeenCalled();
  });

  it("falls back to contract-scoped polling with getContractEvents when contractId is provided", async () => {
    mockGetContractEvents.mockResolvedValue({
      events: [SAMPLE_EVENT_2],
      cursor: null,
      has_more: false,
    });

    const { result } = renderHook(() =>
      useEventStream({
        contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        maxRetries: 3,
      })
    );

    const es = MockEventSource.instances[0];

    act(() => {
      es.simulateError();
      es.simulateError();
      es.simulateError();
    });

    expect(result.current.status).toBe("polling");
    await waitFor(() => {
      expect(mockGetContractEvents).toHaveBeenCalledWith(
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        expect.objectContaining({ limit: 20 })
      );
    });
  });

  it("sends Last-Event-ID as query param on reconnect after an event is received (#616)", () => {
    const { result } = renderHook(() =>
      useEventStream({
        contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      })
    );

    const es1 = MockEventSource.instances[0];
    act(() => {
      es1.simulateOpen();
      es1.simulateMessage({ type: "event", event: SAMPLE_EVENT_1 });
    });

    expect(result.current.lastEventId).toBe("evt-001");

    // Explicitly reconnect or retry
    act(() => {
      result.current.reconnect();
    });

    expect(MockEventSource.instances).toHaveLength(2);
    const es2 = MockEventSource.instances[1];
    expect(es2.url).toContain("last_event_id=evt-001");
  });

  it("resumes without gaps by backfilling missed events on reconnect (#616)", async () => {
    mockGetContractEvents.mockResolvedValue({
      events: [SAMPLE_EVENT_2, SAMPLE_EVENT_1],
      cursor: null,
      has_more: false,
    });

    const { result } = renderHook(() =>
      useEventStream({
        contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      })
    );

    const es1 = MockEventSource.instances[0];
    act(() => {
      es1.simulateOpen();
      es1.simulateMessage({ type: "event", event: SAMPLE_EVENT_1 });
    });

    expect(result.current.events).toHaveLength(1);

    // Reconnect triggered
    act(() => {
      result.current.reconnect();
    });

    const es2 = MockEventSource.instances[1];
    act(() => {
      es2.simulateOpen();
    });

    // Backfill fetches missed events (SAMPLE_EVENT_2)
    await waitFor(() => {
      expect(mockGetContractEvents).toHaveBeenCalledWith(
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        expect.objectContaining({ limit: 50 })
      );
      expect(result.current.events).toHaveLength(2);
      expect(result.current.events.map((e) => e.id)).toEqual([
        "evt-002",
        "evt-001",
      ]);
    });
  });

  it("supports manual reconnect from polling fallback", () => {
    const { result } = renderHook(() =>
      useEventStream({
        maxRetries: 1,
      })
    );

    const es1 = MockEventSource.instances[0];
    act(() => {
      es1.simulateError();
    });

    expect(result.current.status).toBe("polling");

    // User clicks reconnect
    act(() => {
      result.current.reconnect();
    });

    expect(result.current.status).toBe("connecting");
    expect(MockEventSource.instances).toHaveLength(2);
  });

  it("cleans up resources and disconnects when unmounted", () => {
    const { unmount, result } = renderHook(() => useEventStream());
    const es = MockEventSource.instances[0];

    act(() => {
      es.simulateOpen();
    });
    expect(result.current.status).toBe("connected");

    unmount();
    expect(es.close).toHaveBeenCalled();
  });
});
