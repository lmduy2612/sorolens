import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StreamStatusBadge } from "./StreamStatusBadge";

expect.extend(matchers);

describe("StreamStatusBadge (#616)", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders connected live state with pulse indicator and no reconnect button", () => {
    render(<StreamStatusBadge status="connected" onReconnect={vi.fn()} />);

    expect(screen.getByTestId("stream-status-text")).toHaveTextContent(
      "Live (SSE)"
    );
    expect(screen.queryByTestId("stream-reconnect-button")).toBeNull();
  });

  it("renders polling fallback state with amber indicator and reconnect button", () => {
    const onReconnect = vi.fn();
    render(<StreamStatusBadge status="polling" onReconnect={onReconnect} />);

    expect(screen.getByTestId("stream-status-text")).toHaveTextContent(
      "Live (Polling Fallback)"
    );
    const btn = screen.getByTestId("stream-reconnect-button");
    expect(btn).toBeInTheDocument();

    fireEvent.click(btn);
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it("renders reconnecting state with ping indicator and reconnect button", () => {
    const onReconnect = vi.fn();
    render(
      <StreamStatusBadge status="reconnecting" onReconnect={onReconnect} />
    );

    expect(screen.getByTestId("stream-status-text")).toHaveTextContent(
      "Reconnecting..."
    );
    expect(screen.getByTestId("stream-reconnect-button")).toBeInTheDocument();
  });

  it("renders connecting state without reconnect button", () => {
    render(<StreamStatusBadge status="connecting" onReconnect={vi.fn()} />);

    expect(screen.getByTestId("stream-status-text")).toHaveTextContent(
      "Connecting..."
    );
    expect(screen.queryByTestId("stream-reconnect-button")).toBeNull();
  });

  it("renders disconnected state with reconnect button", () => {
    const onReconnect = vi.fn();
    render(
      <StreamStatusBadge status="disconnected" onReconnect={onReconnect} />
    );

    expect(screen.getByTestId("stream-status-text")).toHaveTextContent(
      "Disconnected"
    );
    expect(screen.getByTestId("stream-reconnect-button")).toBeInTheDocument();
  });
});
