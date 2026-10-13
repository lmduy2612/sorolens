"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { getContractForecast } from "@/lib/api";
import type {
  ContractForecastResponse,
  ForecastHorizon,
  ForecastMetric,
  ForecastPoint,
} from "@/lib/types";
import { ChartSkeleton } from "@/components/Skeleton";

export interface CostForecastChartProps {
  contractId: string;
}

const HORIZONS: { label: string; value: ForecastHorizon }[] = [
  { label: "7 Days", value: "7d" },
  { label: "14 Days", value: "14d" },
  { label: "30 Days", value: "30d" },
  { label: "90 Days", value: "90d" },
];

const METRICS: { label: string; value: ForecastMetric }[] = [
  { label: "Fees", value: "fees" },
  { label: "Invocations", value: "invocations" },
  { label: "Events", value: "events" },
];

export function CostForecastChart({ contractId }: CostForecastChartProps) {
  const [horizon, setHorizon] = useState<ForecastHorizon>("30d");
  const [metric, setMetric] = useState<ForecastMetric>("fees");
  const [data, setData] = useState<ContractForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchForecast = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getContractForecast(contractId, horizon);
      setData(res);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load cost forecast."
      );
    } finally {
      setLoading(false);
    }
  }, [contractId, horizon]);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  const activeSeries = data?.series?.find((s) => s.metric === metric);
  const points: ForecastPoint[] = activeSeries?.points ?? [];

  // Check for insufficient data:
  // No points, or all values/bounds are 0
  const hasInsufficientData =
    points.length === 0 ||
    points.every(
      (p) => p.value === 0 && (p.lower ?? 0) === 0 && (p.upper ?? 0) === 0
    );

  // Compute summary stats
  const totalForecast = points.reduce((sum, p) => sum + (p.value || 0), 0);
  const avgDaily = points.length > 0 ? totalForecast / points.length : 0;
  const lowerTotal = points.reduce((sum, p) => sum + (p.lower || 0), 0);
  const upperTotal = points.reduce((sum, p) => sum + (p.upper || 0), 0);

  const formatNumber = (num: number) => {
    if (metric === "fees") {
      return num >= 1000
        ? num.toLocaleString(undefined, { maximumFractionDigits: 1 })
        : num.toFixed(2);
    }
    return Math.round(num).toLocaleString();
  };

  return (
    <div
      data-testid="cost-forecast-card"
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 space-y-6"
    >
      {/* Top Header & Horizon Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            Cost &amp; Usage Forecast
          </h2>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Projected trajectory and statistical confidence ranges based on
            linear trend and weekly seasonality.
          </p>
        </div>

        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Forecast horizon"
        >
          {HORIZONS.map((h) => (
            <button
              key={h.value}
              type="button"
              onClick={() => setHorizon(h.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                horizon === h.value
                  ? "bg-[var(--color-accent)] text-white shadow-sm"
                  : "bg-[var(--color-bg-page)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)]"
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] pb-3">
        {METRICS.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMetric(m.value)}
            className={`rounded-full px-3.5 py-1 text-xs font-medium transition-colors ${
              metric === m.value
                ? "bg-[var(--color-border)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {loading ? (
        <ChartSkeleton />
      ) : error ? (
        <div
          role="alert"
          data-testid="forecast-error"
          className="rounded-lg border border-red-500/30 bg-red-950/20 p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-red-400">{error}</span>
            <button
              type="button"
              onClick={fetchForecast}
              className="rounded-md border border-red-500/40 bg-red-950/40 px-3 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-900/40"
            >
              Retry
            </button>
          </div>
        </div>
      ) : hasInsufficientData ? (
        <div
          data-testid="forecast-insufficient-data"
          className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-page)]/40"
        >
          <div className="rounded-full bg-[var(--color-border)] p-3 mb-3">
            <svg
              className="h-6 w-6 text-[var(--color-text-secondary)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            Insufficient Historical Data
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)] max-w-sm">
            Cost and usage forecasting requires several days of recorded
            transaction history to fit trend models and calculate statistical
            confidence intervals.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-page)]/60 p-3.5">
              <span className="text-xs text-[var(--color-text-secondary)] font-medium">
                Projected Total ({horizon})
              </span>
              <div className="mt-1 text-lg font-semibold font-mono text-[var(--color-text-primary)]">
                {formatNumber(totalForecast)}
              </div>
            </div>

            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-page)]/60 p-3.5">
              <span className="text-xs text-[var(--color-text-secondary)] font-medium">
                Expected Daily Avg
              </span>
              <div className="mt-1 text-lg font-semibold font-mono text-[var(--color-text-primary)]">
                {formatNumber(avgDaily)} / day
              </div>
            </div>

            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-page)]/60 p-3.5">
              <span className="text-xs text-[var(--color-text-secondary)] font-medium">
                Confidence Interval (80%)
              </span>
              <div className="mt-1 text-sm font-semibold font-mono text-[var(--color-text-secondary)]">
                {formatNumber(lowerTotal)} – {formatNumber(upperTotal)}
              </div>
            </div>
          </div>

          {/* Recharts Forecast Visualization */}
          <div data-testid="forecast-chart-container" className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={points}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  opacity={0.6}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0)
                      return null;
                    const pt = payload[0]?.payload as ForecastPoint;
                    if (!pt) return null;
                    return (
                      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 text-xs shadow-md space-y-1">
                        <div className="font-semibold text-[var(--color-text-primary)]">
                          {label}
                        </div>
                        <div className="text-[var(--color-accent)] font-medium">
                          Projected:{" "}
                          <span className="font-mono">
                            {formatNumber(pt.value)}
                          </span>
                        </div>
                        <div className="text-[var(--color-text-secondary)]">
                          Confidence Range:{" "}
                          <span className="font-mono">
                            {formatNumber(pt.lower)} – {formatNumber(pt.upper)}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "0.75rem", paddingTop: "0.75rem" }}
                />
                <Line
                  type="monotone"
                  dataKey="upper"
                  name="Upper Bound"
                  stroke="var(--color-accent)"
                  strokeDasharray="3 3"
                  strokeOpacity={0.4}
                  dot={false}
                  strokeWidth={1}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Projected Value"
                  stroke="var(--color-accent)"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="lower"
                  name="Lower Bound"
                  stroke="var(--color-accent)"
                  strokeDasharray="3 3"
                  strokeOpacity={0.4}
                  dot={false}
                  strokeWidth={1}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

export default CostForecastChart;
