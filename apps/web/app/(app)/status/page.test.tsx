/**
 * Tests for apps/web/app/(app)/status/page.tsx
 */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StatusPage from "./page";
import * as statusLib from "@/lib/status";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

describe("StatusPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const healthyStatus: statusLib.SystemStatusData = {
    version: {
      version: "1.4.2",
      git_sha: "7a8b9c0",
      built_at: "2026-02-15T12:00:00Z",
    },
    health: {
      status: "ok",
      db: "connected",
      redis: "connected",
      timestamp: "2026-02-15T12:00:00Z",
    },
    indexer: [
      {
        network: "mainnet",
        last_indexed_ledger: 1045000,
        head_ledger: 1045002,
        lag_ledgers: 2,
        status: "synced",
      },
      {
        network: "testnet",
        last_indexed_ledger: 890000,
        head_ledger: 890005,
        lag_ledgers: 5,
        status: "synced",
      },
      {
        network: "futurenet",
        last_indexed_ledger: 450000,
        head_ledger: 450060,
        lag_ledgers: 60,
        status: "degraded",
      },
    ],
    overallStatus: "operational",
    checkedAt: Date.now(),
  };

  it("renders system status banner, health, version, and indexer lag", async () => {
    vi.spyOn(statusLib, "fetchSystemStatus").mockResolvedValue(healthyStatus);

    render(<StatusPage />);

    expect(screen.getByText("System Status")).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText("All Systems Operational")).toBeDefined();
    });

    // Health details
    expect(screen.getByText("API & Readiness Checks")).toBeDefined();
    expect(screen.getAllByText("connected").length).toBe(2);

    // Version details
    expect(screen.getByText("1.4.2")).toBeDefined();
    expect(screen.getByText("7a8b9c0")).toBeDefined();

    // Indexer table
    expect(screen.getByText("Indexer Lag & Progress")).toBeDefined();
    expect(screen.getByText("mainnet")).toBeDefined();
    expect(screen.getByText("testnet")).toBeDefined();
    expect(screen.getByText("futurenet")).toBeDefined();
    expect(screen.getByText("2 ledgers")).toBeDefined();
  });

  it("renders degraded status banner when overall status is degraded", async () => {
    vi.spyOn(statusLib, "fetchSystemStatus").mockResolvedValue({
      ...healthyStatus,
      overallStatus: "degraded",
      indexerError: "Metrics partially unavailable",
    });

    render(<StatusPage />);

    await waitFor(() => {
      expect(screen.getByText("Degraded Performance")).toBeDefined();
    });
    expect(screen.getByText("Metrics partially unavailable")).toBeDefined();
  });

  it("renders outage banner when database is down", async () => {
    vi.spyOn(statusLib, "fetchSystemStatus").mockResolvedValue({
      ...healthyStatus,
      overallStatus: "outage",
      health: {
        status: "degraded",
        db: "unreachable",
        redis: "connected",
        timestamp: "2026-02-15T12:00:00Z",
      },
    });

    render(<StatusPage />);

    await waitFor(() => {
      expect(screen.getByText("Partial Service Outage")).toBeDefined();
    });
    expect(screen.getByText("unreachable")).toBeDefined();
  });

  it("displays partial error alerts when version fails", async () => {
    vi.spyOn(statusLib, "fetchSystemStatus").mockResolvedValue({
      ...healthyStatus,
      version: null,
      versionError: "Failed to load version",
      overallStatus: "degraded",
    });

    render(<StatusPage />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load version")).toBeDefined();
    });
  });

  it("allows toggling auto-refresh and manually refreshing", async () => {
    const fetchSpy = vi
      .spyOn(statusLib, "fetchSystemStatus")
      .mockResolvedValue(healthyStatus);

    render(<StatusPage />);

    await waitFor(() => {
      expect(screen.getByText("All Systems Operational")).toBeDefined();
    });

    const refreshBtn = screen.getByRole("button", { name: "Refresh now" });
    fireEvent.click(refreshBtn);

    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const autoRefreshCheckbox = screen.getByLabelText(
      "Auto-refresh"
    ) as HTMLInputElement;
    fireEvent.click(autoRefreshCheckbox);
    expect(autoRefreshCheckbox.checked).toBe(false);
  });
});
