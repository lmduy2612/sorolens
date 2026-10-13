/**
 * Tests for CostForecastChart component (issue #602)
 */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CostForecastChart } from "./CostForecastChart";
import * as api from "@/lib/api";
import type { ContractForecastResponse } from "@/lib/types";

// Mock recharts primitives
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  ComposedChart: ({
    data,
    children,
  }: {
    data?: unknown[];
    children?: React.ReactNode;
  }) => (
    <div data-testid="composed-chart" data-points={data?.length ?? 0}>
      {children}
    </div>
  ),
  Line: ({ dataKey, name }: { dataKey?: string; name?: string }) => (
    <div data-testid="chart-line" data-key={dataKey} data-name={name} />
  ),
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

describe("CostForecastChart", () => {
  const contractId = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockForecast: ContractForecastResponse = {
    contract_id: contractId,
    lookback_days: 90,
    series: [
      {
        metric: "fees",
        horizon: 30,
        daily_count: 2,
        points: [
          { date: "2026-03-01", value: 10.5, lower: 8.0, upper: 13.0 },
          { date: "2026-03-02", value: 12.0, lower: 9.0, upper: 15.0 },
        ],
      },
      {
        metric: "invocations",
        horizon: 30,
        daily_count: 2,
        points: [
          { date: "2026-03-01", value: 100, lower: 80, upper: 120 },
          { date: "2026-03-02", value: 110, lower: 90, upper: 130 },
        ],
      },
      {
        metric: "events",
        horizon: 30,
        daily_count: 2,
        points: [
          { date: "2026-03-01", value: 50, lower: 40, upper: 60 },
          { date: "2026-03-02", value: 55, lower: 45, upper: 65 },
        ],
      },
    ],
  };

  it("renders cost forecast chart with summary cards and confidence range", async () => {
    vi.spyOn(api, "getContractForecast").mockResolvedValue(mockForecast);

    render(<CostForecastChart contractId={contractId} />);

    await waitFor(() => {
      expect(screen.getByText("Cost & Usage Forecast")).toBeDefined();
    });

    // Check summary statistics
    expect(screen.getByText("Projected Total (30d)")).toBeDefined();
    expect(screen.getByText("22.50")).toBeDefined(); // 10.5 + 12.0
    expect(screen.getByText("Expected Daily Avg")).toBeDefined();
    expect(screen.getByText("11.25 / day")).toBeDefined();
    expect(screen.getByText("17.00 – 28.00")).toBeDefined(); // lower 17, upper 28

    // Chart rendered
    expect(screen.getByTestId("composed-chart")).toBeDefined();
    const lines = screen.getAllByTestId("chart-line");
    expect(lines.length).toBe(3); // upper, value, lower
  });

  it("handles insufficient historical data state when points are empty or zero", async () => {
    vi.spyOn(api, "getContractForecast").mockResolvedValue({
      contract_id: contractId,
      lookback_days: 90,
      series: [
        {
          metric: "fees",
          horizon: 30,
          daily_count: 0,
          points: [],
        },
      ],
    });

    render(<CostForecastChart contractId={contractId} />);

    await waitFor(() => {
      expect(screen.getByTestId("forecast-insufficient-data")).toBeDefined();
    });
    expect(screen.getByText("Insufficient Historical Data")).toBeDefined();
  });

  it("allows switching horizons and fetches updated data", async () => {
    const fetchSpy = vi
      .spyOn(api, "getContractForecast")
      .mockResolvedValue(mockForecast);

    render(<CostForecastChart contractId={contractId} />);

    await waitFor(() => {
      expect(screen.getByText("Cost & Usage Forecast")).toBeDefined();
    });

    expect(fetchSpy).toHaveBeenCalledWith(contractId, "30d");

    // Click 7 Days
    const sevenDayBtn = screen.getByRole("button", { name: "7 Days" });
    fireEvent.click(sevenDayBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(contractId, "7d");
    });
  });

  it("allows switching between fees, invocations, and events metrics", async () => {
    vi.spyOn(api, "getContractForecast").mockResolvedValue(mockForecast);

    render(<CostForecastChart contractId={contractId} />);

    await waitFor(() => {
      expect(screen.getByText("22.50")).toBeDefined();
    });

    // Switch to Invocations
    const invocationsTab = screen.getByRole("button", { name: "Invocations" });
    fireEvent.click(invocationsTab);

    // 100 + 110 = 210
    expect(screen.getByText("210")).toBeDefined();
    expect(screen.getByText("105 / day")).toBeDefined();

    // Switch to Events
    const eventsTab = screen.getByRole("button", { name: "Events" });
    fireEvent.click(eventsTab);

    // 50 + 55 = 105
    expect(screen.getByText("105")).toBeDefined();
  });

  it("renders error state and supports retry", async () => {
    const fetchSpy = vi
      .spyOn(api, "getContractForecast")
      .mockRejectedValueOnce(new Error("Database connection refused"))
      .mockResolvedValueOnce(mockForecast);

    render(<CostForecastChart contractId={contractId} />);

    await waitFor(() => {
      expect(screen.getByTestId("forecast-error")).toBeDefined();
    });
    expect(screen.getByText("Database connection refused")).toBeDefined();

    const retryBtn = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId("composed-chart")).toBeDefined();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
