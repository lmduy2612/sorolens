import { API_URL, fetchJson } from "@/lib/api";

export interface ApiVersion {
  version: string;
  git_sha: string;
  built_at: string;
}

export interface ApiHealth {
  status: "ok" | "degraded" | string;
  db: "connected" | "unreachable" | string;
  redis: "connected" | "unreachable" | string;
  timestamp: string;
}

export interface NetworkLagInfo {
  network: string;
  last_indexed_ledger: number | null;
  head_ledger: number | null;
  lag_ledgers: number | null;
  status: "synced" | "lagging" | "degraded" | "unknown";
}

export interface SystemStatusData {
  version: ApiVersion | null;
  versionError?: string;
  health: ApiHealth | null;
  healthError?: string;
  indexer: NetworkLagInfo[];
  indexerError?: string;
  overallStatus: "operational" | "degraded" | "outage";
  checkedAt: number;
}

/** Parses raw Prometheus exposition text for indexer lag and ledger gauges. */
export function parseIndexerMetrics(
  text: string
): Record<string, { lag?: number; head?: number; last_indexed?: number }> {
  const result: Record<
    string,
    { lag?: number; head?: number; last_indexed?: number }
  > = {};
  if (!text) return result;

  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // sorolens_indexer_lag_ledgers{network="testnet"} 12
    const lagMatch = trimmed.match(
      /sorolens_indexer_lag_ledgers\{[^}]*network="([^"]+)"[^}]*\}\s+([\d.]+)/
    );
    if (lagMatch) {
      const net = lagMatch[1];
      const val = parseFloat(lagMatch[2]);
      result[net] = { ...result[net], lag: val };
    }

    // sorolens_indexer_head_ledger{network="testnet"} 1000
    const headMatch = trimmed.match(
      /sorolens_indexer_head_ledger\{[^}]*network="([^"]+)"[^}]*\}\s+([\d.]+)/
    );
    if (headMatch) {
      const net = headMatch[1];
      const val = parseFloat(headMatch[2]);
      result[net] = { ...result[net], head: val };
    }

    // sorolens_indexer_last_indexed_ledger{network="testnet"} 988
    const lastMatch = trimmed.match(
      /sorolens_indexer_last_indexed_ledger\{[^}]*network="([^"]+)"[^}]*\}\s+([\d.]+)/
    );
    if (lastMatch) {
      const net = lastMatch[1];
      const val = parseFloat(lastMatch[2]);
      result[net] = { ...result[net], last_indexed: val };
    }
  }

  return result;
}

/** Fetches API build information. */
export async function fetchApiVersion(): Promise<ApiVersion> {
  return fetchJson<ApiVersion>(`${API_URL}/api/version`);
}

/** Fetches API health and dependency status. */
export async function fetchApiHealth(): Promise<ApiHealth> {
  return fetchJson<ApiHealth>(`${API_URL}/api/v1/health`);
}

/**
 * Fetches and parses Prometheus metrics to determine per-network indexer lag.
 * Falls back to an empty record on failure so other checks can proceed.
 */
export async function fetchIndexerLagMetrics(): Promise<
  Record<string, { lag?: number; head?: number; last_indexed?: number }>
> {
  const res = await fetch(`${API_URL}/metrics`);
  if (!res.ok) {
    throw new Error(`Metrics endpoint returned ${res.status}`);
  }
  const text = await res.text();
  return parseIndexerMetrics(text);
}

const SUPPORTED_NETWORKS = ["mainnet", "testnet", "futurenet"];

/**
 * Aggregates all status signals with complete resilience to partial failures.
 */
export async function fetchSystemStatus(): Promise<SystemStatusData> {
  const [versionRes, healthRes, metricsRes] = await Promise.allSettled([
    fetchApiVersion(),
    fetchApiHealth(),
    fetchIndexerLagMetrics(),
  ]);

  let version: ApiVersion | null = null;
  let versionError: string | undefined;
  if (versionRes.status === "fulfilled") {
    version = versionRes.value;
  } else {
    versionError =
      versionRes.reason instanceof Error
        ? versionRes.reason.message
        : "Failed to load version";
  }

  let health: ApiHealth | null = null;
  let healthError: string | undefined;
  if (healthRes.status === "fulfilled") {
    health = healthRes.value;
  } else {
    healthError =
      healthRes.reason instanceof Error
        ? healthRes.reason.message
        : "Failed to check health";
  }

  const indexer: NetworkLagInfo[] = [];
  let indexerError: string | undefined;

  if (metricsRes.status === "fulfilled") {
    const metricsMap = metricsRes.value;
    for (const net of SUPPORTED_NETWORKS) {
      const sample = metricsMap[net];
      if (
        sample &&
        (sample.lag !== undefined || sample.last_indexed !== undefined)
      ) {
        const lag =
          sample.lag ??
          (sample.head !== undefined && sample.last_indexed !== undefined
            ? sample.head - sample.last_indexed
            : null);
        let status: NetworkLagInfo["status"] = "synced";
        if (lag !== null) {
          if (lag > 50) status = "degraded";
          else if (lag > 10) status = "lagging";
        }
        indexer.push({
          network: net,
          last_indexed_ledger: sample.last_indexed ?? null,
          head_ledger: sample.head ?? null,
          lag_ledgers: lag,
          status,
        });
      } else {
        indexer.push({
          network: net,
          last_indexed_ledger: null,
          head_ledger: null,
          lag_ledgers: null,
          status: "unknown",
        });
      }
    }
  } else {
    indexerError =
      metricsRes.reason instanceof Error
        ? metricsRes.reason.message
        : "Indexer metrics unavailable";
    for (const net of SUPPORTED_NETWORKS) {
      indexer.push({
        network: net,
        last_indexed_ledger: null,
        head_ledger: null,
        lag_ledgers: null,
        status: "unknown",
      });
    }
  }

  // Determine overall status
  let overallStatus: SystemStatusData["overallStatus"] = "operational";
  if (
    healthError ||
    (health && (health.db === "unreachable" || health.redis === "unreachable"))
  ) {
    overallStatus = "outage";
  } else if (
    versionError ||
    indexerError ||
    (health && health.status === "degraded") ||
    indexer.some((i) => i.status === "degraded" || i.status === "lagging")
  ) {
    overallStatus = "degraded";
  }

  return {
    version,
    versionError,
    health,
    healthError,
    indexer,
    indexerError,
    overallStatus,
    checkedAt: Date.now(),
  };
}
