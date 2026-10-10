import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EventsPage from "./page";

expect.extend(matchers);

// ── Mock next/link ──────────────────────────────────────────────────────────
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// ── Mock EventsTable ────────────────────────────────────────────────────────
vi.mock("@/components/EventsTable", () => ({
  EventsTable: ({ events }: { events: unknown[] }) => (
    <div data-testid="events-table">Events count: {events.length}</div>
  ),
}));

import type { StreamStatus } from "@/hooks/useEventStream";

// ── Mock useEventStream ─────────────────────────────────────────────────────
const mockReconnect = vi.fn();
const mockSetEvents = vi.fn();

let mockHookReturn: {
  events: unknown[];
  setEvents: typeof mockSetEvents;
  status: StreamStatus;
  isConnected: boolean;
  isPolling: boolean;
  isReconnecting: boolean;
  lastEventAt: Date | null;
  lastEventId: string | null;
  reconnect: typeof mockReconnect;
} = {
  events: [],
  setEvents: mockSetEvents,
  status: "connected",
  isConnected: true,
  isPolling: false,
  isReconnecting: false,
  lastEventAt: new Date("2026-10-10T12:00:00Z"),
  lastEventId: "evt-test-1234567890",
  reconnect: mockReconnect,
};

vi.mock("@/hooks/useEventStream", () => ({
  useEventStream: () => mockHookReturn,
}));

describe("LiveEventsPage (#616)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookReturn = {
      events: [],
      setEvents: mockSetEvents,
      status: "connected",
      isConnected: true,
      isPolling: false,
      isReconnecting: false,
      lastEventAt: new Date("2026-10-10T12:00:00Z"),
      lastEventId: "evt-test-1234567890",
      reconnect: mockReconnect,
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("renders live events page with connected SSE badge and stat cards", () => {
    render(<EventsPage />);

    expect(
      screen.getByRole("heading", { name: "Live Events" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("stream-status-text")).toHaveTextContent(
      "Live (SSE)"
    );
    expect(screen.getByText("Server-Sent Events active")).toBeInTheDocument();
    expect(screen.getByTestId("events-table")).toBeInTheDocument();
  });

  it("displays polling fallback banner and reconnect button when stream falls back to polling (#616)", () => {
    mockHookReturn = {
      ...mockHookReturn,
      status: "polling",
      isConnected: false,
      isPolling: true,
    };

    render(<EventsPage />);

    expect(screen.getByTestId("stream-status-text")).toHaveTextContent(
      "Live (Polling Fallback)"
    );
    expect(screen.getByTestId("polling-fallback-banner")).toBeInTheDocument();

    const bannerBtn = screen.getByTestId("banner-reconnect-button");
    expect(bannerBtn).toHaveTextContent("Retry Live Stream");

    fireEvent.click(bannerBtn);
    expect(mockReconnect).toHaveBeenCalledTimes(1);
  });

  it("displays reconnecting banner when connection is interrupted", () => {
    mockHookReturn = {
      ...mockHookReturn,
      status: "reconnecting",
      isConnected: false,
      isReconnecting: true,
    };

    render(<EventsPage />);

    expect(screen.getByTestId("stream-status-text")).toHaveTextContent(
      "Reconnecting..."
    );
    expect(screen.getByTestId("reconnecting-banner")).toBeInTheDocument();
    expect(
      screen.getByText(/Resuming stream with Last-Event-ID/i)
    ).toBeInTheDocument();
  });

  it("handles contract id filter input and clear", () => {
    render(<EventsPage />);

    const input = screen.getByPlaceholderText(/filter by contract id/i);
    const filterBtn = screen.getByRole("button", { name: "Filter" });

    fireEvent.change(input, {
      target: {
        value: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      },
    });
    fireEvent.click(filterBtn);

    expect(mockSetEvents).toHaveBeenCalledWith([]);

    const clearBtn = screen.getByRole("button", { name: "Clear" });
    fireEvent.click(clearBtn);

    expect((input as HTMLInputElement).value).toBe("");
  });
});
