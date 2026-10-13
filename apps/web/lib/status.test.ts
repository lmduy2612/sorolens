import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseIndexerMetrics, fetchSystemStatus } from "./status";
import * as api from "@/lib/api";

describe("status helpers", () => {
  describe("parseIndexerMetrics", () => {
    it("parses prometheus exposition format for indexer metrics", () => {
      const text = `
# HELP sorolens_indexer_lag_ledgers Number of ledgers behind
# TYPE sorolens_indexer_lag_ledgers gauge
sorolens_indexer_lag_ledgers{network="testnet"} 12
sorolens_indexer_lag_ledgers{network="mainnet"} 0
sorolens_indexer_head_ledger{network="testnet"} 500000
sorolens_indexer_last_indexed_ledger{network="testnet"} 499988
      `.trim();

      const parsed = parseIndexerMetrics(text);
      expect(parsed.testnet).toBeDefined();
      expect(parsed.testnet.lag).toBe(12);
      expect(parsed.testnet.head).toBe(500000);
      expect(parsed.testnet.last_indexed).toBe(499988);
      expect(parsed.mainnet).toBeDefined();
      expect(parsed.mainnet.lag).toBe(0);
    });

    it("returns empty object for empty or comment-only string", () => {
      expect(parseIndexerMetrics("")).toEqual({});
      expect(parseIndexerMetrics("# just comments\n# nothing else")).toEqual(
        {}
      );
    });
  });

  describe("fetchSystemStatus", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("aggregates status when all services are healthy", async () => {
      const fetchJsonSpy = vi
        .spyOn(api, "fetchJson")
        .mockImplementation((url: string) => {
          if (url.includes("/api/version")) {
            return Promise.resolve({
              version: "1.4.2",
              git_sha: "abc1234",
              built_at: "2026-01-02T15:04:05Z",
            });
          }
          if (url.includes("/api/v1/health")) {
            return Promise.resolve({
              status: "ok",
              db: "connected",
              redis: "connected",
              timestamp: "2026-01-02T15:04:05Z",
            });
          }
          return Promise.reject(new Error("unexpected url"));
        });

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            'sorolens_indexer_lag_ledgers{network="mainnet"} 2\nsorolens_indexer_last_indexed_ledger{network="mainnet"} 1000'
          ),
      } as Response);

      const status = await fetchSystemStatus();

      expect(status.overallStatus).toBe("operational");
      expect(status.version?.version).toBe("1.4.2");
      expect(status.health?.status).toBe("ok");
      expect(
        status.indexer.find((i) => i.network === "mainnet")?.lag_ledgers
      ).toBe(2);
      expect(status.indexer.find((i) => i.network === "mainnet")?.status).toBe(
        "synced"
      );

      fetchJsonSpy.mockRestore();
      fetchSpy.mockRestore();
    });

    it("handles partial failure when version endpoint fails", async () => {
      const fetchJsonSpy = vi
        .spyOn(api, "fetchJson")
        .mockImplementation((url: string) => {
          if (url.includes("/api/version")) {
            return Promise.reject(new Error("503 Service Unavailable"));
          }
          if (url.includes("/api/v1/health")) {
            return Promise.resolve({
              status: "ok",
              db: "connected",
              redis: "connected",
              timestamp: "2026-01-02T15:04:05Z",
            });
          }
          return Promise.reject(new Error("unexpected url"));
        });

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(""),
      } as Response);

      const status = await fetchSystemStatus();

      expect(status.overallStatus).toBe("degraded");
      expect(status.version).toBeNull();
      expect(status.versionError).toContain("503");
      expect(status.health?.status).toBe("ok");

      fetchJsonSpy.mockRestore();
      fetchSpy.mockRestore();
    });

    it("marks status as outage when database is unreachable", async () => {
      const fetchJsonSpy = vi
        .spyOn(api, "fetchJson")
        .mockImplementation((url: string) => {
          if (url.includes("/api/version")) {
            return Promise.resolve({
              version: "1.4.2",
              git_sha: "abc",
              built_at: "2026-01-01",
            });
          }
          if (url.includes("/api/v1/health")) {
            return Promise.resolve({
              status: "degraded",
              db: "unreachable",
              redis: "connected",
              timestamp: "2026-01-01",
            });
          }
          return Promise.reject(new Error("unexpected url"));
        });

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const status = await fetchSystemStatus();

      expect(status.overallStatus).toBe("outage");
      expect(status.health?.db).toBe("unreachable");

      fetchJsonSpy.mockRestore();
      fetchSpy.mockRestore();
    });
  });
});
