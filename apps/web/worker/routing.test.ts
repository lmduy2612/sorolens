import { describe, expect, it } from "vitest";
import {
  hasUserIdentityHeader,
  IDENTITY_HEADERS,
  isCacheableInternalApi,
  isCacheableUpstreamApi,
  isUserScopedPath,
  isUserScopedRequest,
  USER_SCOPED_PATH_REGEX,
} from "./routing";

const API_BASE = "http://localhost:8080";

function makeUrl(path: string, base: string = API_BASE): URL {
  return new URL(path, base);
}

function makeRequest(
  url: string,
  options?: {
    method?: string;
    headers?: Record<string, string>;
  }
): Request {
  return new Request(url, {
    method: options?.method || "GET",
    headers: options?.headers,
  });
}

describe("Service Worker Routing & Security Isolation (#615)", () => {
  describe("isUserScopedPath", () => {
    it("identifies user-scoped paths correctly", () => {
      const userPaths = [
        "/api/v1/watchlist",
        "/api/v1/watchlist/",
        "/api/v1/watchlist/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC/status",
        "/api/v1/watchdog/subscriptions",
        "/api/v1/watchdog/subscriptions/sub_123",
        "/api/v1/groups",
        "/api/v1/groups/portfolio-1",
        "/api/v1/groups/portfolio-1/stats",
        "/api/v1/groups/portfolio-1/contracts",
        "/api/v1/contracts/C123/notes",
        "/api/v1/contracts/C123/notes/note_1",
        "/api/v1/api-keys",
        "/api/v1/api-keys/key_1",
        "/api/v1/admin/keys",
        "/api/v1/admin/audit",
        "/api/push/subscribe",
        "/api/push",
      ];

      for (const p of userPaths) {
        expect(isUserScopedPath(p), `Path should be user-scoped: ${p}`).toBe(
          true
        );
      }
    });

    it("does not classify public paths as user-scoped", () => {
      const publicPaths = [
        "/api/v1/contracts",
        "/api/v1/contracts/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        "/api/v1/contracts/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC/events",
        "/api/v1/contracts/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC/stats",
        "/api/v1/events",
        "/api/v1/events/recent",
        "/api/v1/stats/global",
        "/api/v1/stats/activity",
        "/api/v1/watchdog/stats",
        "/api/v1/watchdog/alerts",
        "/api/v1/rules",
        "/api/v1/search",
        "/api/v1/compare",
        "/api/v1/health",
      ];

      for (const p of publicPaths) {
        expect(
          isUserScopedPath(p),
          `Path should NOT be user-scoped: ${p}`
        ).toBe(false);
      }
    });
  });

  describe("hasUserIdentityHeader", () => {
    it("returns true when X-User-ID is present", () => {
      const req = makeRequest("http://localhost:8080/api/v1/contracts", {
        headers: { "X-User-ID": "usr_alpha_1" },
      });
      expect(hasUserIdentityHeader(req)).toBe(true);
    });

    it("is case-insensitive for identity headers", () => {
      const reqLower = makeRequest("http://localhost:8080/api/v1/contracts", {
        headers: { "x-user-id": "usr_alpha_1" },
      });
      expect(hasUserIdentityHeader(reqLower)).toBe(true);

      const reqAuth = makeRequest("http://localhost:8080/api/v1/contracts", {
        headers: { authorization: "Bearer secret-token" },
      });
      expect(hasUserIdentityHeader(reqAuth)).toBe(true);

      const reqApiKey = makeRequest("http://localhost:8080/api/v1/contracts", {
        headers: { "x-api-key": "soro_key_123" },
      });
      expect(hasUserIdentityHeader(reqApiKey)).toBe(true);
    });

    it("returns false for requests without identity headers", () => {
      const req = makeRequest("http://localhost:8080/api/v1/contracts", {
        headers: { Accept: "application/json" },
      });
      expect(hasUserIdentityHeader(req)).toBe(false);
    });

    it("ignores empty or whitespace-only identity headers", () => {
      const reqEmpty = makeRequest("http://localhost:8080/api/v1/contracts", {
        headers: { "X-User-ID": "   " },
      });
      expect(hasUserIdentityHeader(reqEmpty)).toBe(false);
    });
  });

  describe("isUserScopedRequest", () => {
    it("matches requests targeting user-scoped paths even without identity header", () => {
      const url = makeUrl("/api/v1/watchlist");
      const req = makeRequest(url.href);
      expect(isUserScopedRequest({ url, request: req })).toBe(true);
    });

    it("matches requests targeting subscriptions", () => {
      const url = makeUrl("/api/v1/watchdog/subscriptions");
      const req = makeRequest(url.href);
      expect(isUserScopedRequest({ url, request: req })).toBe(true);
    });

    it("matches requests targeting groups", () => {
      const url = makeUrl("/api/v1/groups");
      const req = makeRequest(url.href);
      expect(isUserScopedRequest({ url, request: req })).toBe(true);
    });

    it("matches requests carrying X-User-ID even on public paths", () => {
      const url = makeUrl("/api/v1/contracts");
      const req = makeRequest(url.href, {
        headers: { "X-User-ID": "usr_test" },
      });
      expect(isUserScopedRequest({ url, request: req })).toBe(true);
    });

    it("returns false for anonymous requests to public paths", () => {
      const url = makeUrl("/api/v1/contracts");
      const req = makeRequest(url.href);
      expect(isUserScopedRequest({ url, request: req })).toBe(false);
    });
  });

  describe("isCacheableUpstreamApi", () => {
    it("allows caching for public anonymous GET requests to upstream API", () => {
      const publicUrls = [
        "/api/v1/contracts",
        "/api/v1/contracts/C123",
        "/api/v1/contracts/C123/events",
        "/api/v1/events",
        "/api/v1/stats/global",
        "/api/v1/watchdog/stats",
        "/api/v1/alerts",
        "/api/v1/search?q=soroban",
      ];

      for (const p of publicUrls) {
        const url = makeUrl(p);
        const req = makeRequest(url.href, { method: "GET" });
        expect(
          isCacheableUpstreamApi({ url, request: req }),
          `Should cache public GET: ${p}`
        ).toBe(true);
      }
    });

    it("NEVER caches user-scoped watchlist endpoints", () => {
      const watchlistUrl = makeUrl("/api/v1/watchlist");
      const req = makeRequest(watchlistUrl.href, {
        headers: { "X-User-ID": "alice" },
      });
      expect(isCacheableUpstreamApi({ url: watchlistUrl, request: req })).toBe(
        false
      );

      // Even without header, watchlist path must never be cached
      const reqNoHeader = makeRequest(watchlistUrl.href);
      expect(
        isCacheableUpstreamApi({ url: watchlistUrl, request: reqNoHeader })
      ).toBe(false);
    });

    it("NEVER caches user-scoped subscription endpoints", () => {
      const subUrl = makeUrl("/api/v1/watchdog/subscriptions");
      const req = makeRequest(subUrl.href, {
        headers: { "X-User-ID": "alice" },
      });
      expect(isCacheableUpstreamApi({ url: subUrl, request: req })).toBe(false);
    });

    it("NEVER caches user-scoped groups endpoints", () => {
      const groupUrl = makeUrl("/api/v1/groups/group_1/stats");
      const req = makeRequest(groupUrl.href, {
        headers: { "X-User-ID": "bob" },
      });
      expect(isCacheableUpstreamApi({ url: groupUrl, request: req })).toBe(
        false
      );
    });

    it("NEVER caches requests carrying user identity headers", () => {
      const url = makeUrl("/api/v1/contracts");
      const req = makeRequest(url.href, {
        headers: { "X-User-ID": "alice" },
      });
      expect(isCacheableUpstreamApi({ url, request: req })).toBe(false);
    });

    it("NEVER caches non-GET requests (mutations)", () => {
      const url = makeUrl("/api/v1/contracts");
      const postReq = makeRequest(url.href, { method: "POST" });
      expect(isCacheableUpstreamApi({ url, request: postReq })).toBe(false);

      const deleteReq = makeRequest(url.href, { method: "DELETE" });
      expect(isCacheableUpstreamApi({ url, request: deleteReq })).toBe(false);

      const patchReq = makeRequest(url.href, { method: "PATCH" });
      expect(isCacheableUpstreamApi({ url, request: patchReq })).toBe(false);
    });

    it("NEVER caches streaming or WebSocket endpoints", () => {
      const sseUrl = makeUrl("/api/v1/stream/events");
      const sseReq = makeRequest(sseUrl.href);
      expect(isCacheableUpstreamApi({ url: sseUrl, request: sseReq })).toBe(
        false
      );

      const contractStreamUrl = makeUrl("/api/v1/contracts/C123/stream");
      const contractStreamReq = makeRequest(contractStreamUrl.href);
      expect(
        isCacheableUpstreamApi({
          url: contractStreamUrl,
          request: contractStreamReq,
        })
      ).toBe(false);

      const wsUrl = makeUrl("/api/v1/subscribe");
      const wsReq = makeRequest(wsUrl.href);
      expect(isCacheableUpstreamApi({ url: wsUrl, request: wsReq })).toBe(
        false
      );
    });

    it("ignores requests from non-API domains", () => {
      const url = new URL("https://external-service.org/api/v1/contracts");
      const req = makeRequest(url.href);
      expect(isCacheableUpstreamApi({ url, request: req })).toBe(false);
    });
  });

  describe("isCacheableInternalApi", () => {
    it("allows caching for public internal API routes", () => {
      const url = new URL("http://localhost:3000/api/version");
      const req = makeRequest(url.href);
      expect(isCacheableInternalApi({ url, request: req })).toBe(true);
    });

    it("excludes internal user push routes", () => {
      const url = new URL("http://localhost:3000/api/push/subscribe");
      const req = makeRequest(url.href);
      expect(isCacheableInternalApi({ url, request: req })).toBe(false);
    });

    it("excludes requests with user identity headers", () => {
      const url = new URL("http://localhost:3000/api/version");
      const req = makeRequest(url.href, {
        headers: { "X-User-ID": "user-123" },
      });
      expect(isCacheableInternalApi({ url, request: req })).toBe(false);
    });

    it("excludes non-GET methods", () => {
      const url = new URL("http://localhost:3000/api/push/subscribe");
      const req = makeRequest(url.href, { method: "POST" });
      expect(isCacheableInternalApi({ url, request: req })).toBe(false);
    });
  });
});
