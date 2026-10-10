/**
 * worker/routing.ts — Service Worker API route caching rules & security isolation (#615).
 *
 * Implements strict isolation between public and user-scoped data in the
 * PWA Service Worker runtime cache.
 *
 * Security & Data Privacy Policy:
 * 1. User-scoped endpoints (e.g. /watchlist, /watchdog/subscriptions, /groups,
 *    /contracts/:id/notes, /api/push) MUST NEVER be cached across users in the
 *    shared browser Cache Storage. They are handled with NetworkOnly.
 * 2. Any request bearing a user identity or credential header (X-User-ID,
 *    Authorization, X-API-Key, X-GitHub-ID, etc.) MUST NEVER be cached.
 * 3. Non-idempotent HTTP methods (POST, PUT, PATCH, DELETE) are mutations and
 *    MUST NEVER be cached.
 * 4. Streaming endpoints (SSE /stream/*, WebSocket /subscribe) MUST NEVER be cached.
 * 5. Only public, anonymous GET/HEAD requests to idempotent endpoints are cached
 *    (StaleWhileRevalidate, 5m TTL) to support offline viewing and fast load times.
 *
 * NOTE: Functions used as Workbox urlPattern callbacks must remain self-contained
 * because workbox-build serializes function bodies via Function.prototype.toString()
 * into the generated sw.js.
 */

export const IDENTITY_HEADERS = [
  "x-user-id",
  "authorization",
  "x-api-key",
  "x-github-id",
  "x-github-login",
] as const;

export const USER_SCOPED_PATH_REGEX =
  /\/(watchlist|watchdog\/subscriptions|groups|api-keys|admin|contracts\/[^/]+\/notes|api\/push)(\/|$)/i;

/**
 * Checks whether a URL pathname matches a user-scoped endpoint.
 */
export function isUserScopedPath(pathname: string): boolean {
  return USER_SCOPED_PATH_REGEX.test(pathname);
}

/**
 * Checks whether a request contains user identity or authentication headers.
 */
export function hasUserIdentityHeader(
  request?: Request | { headers?: Headers | Record<string, string> }
): boolean {
  if (!request || !request.headers) return false;

  for (const name of IDENTITY_HEADERS) {
    let val: string | null = null;
    if (typeof (request.headers as Headers).get === "function") {
      val = (request.headers as Headers).get(name);
    } else {
      const raw = request.headers as Record<string, string>;
      const lower = name.toLowerCase();
      for (const k of Object.keys(raw)) {
        if (k.toLowerCase() === lower) {
          val = raw[k];
          break;
        }
      }
    }
    if (val && val.trim() !== "") {
      return true;
    }
  }

  return false;
}

/**
 * Workbox urlPattern callback matching any user-scoped or authenticated request.
 * Handled with NetworkOnly in the service worker.
 *
 * Self-contained for workbox-build serialization.
 */
export function isUserScopedRequest({
  url,
  request,
}: {
  url: URL;
  request?: Request;
}): boolean {
  // 1. Check HTTP headers for user identity / credentials
  if (request && request.headers) {
    const identityHeaders = [
      "x-user-id",
      "authorization",
      "x-api-key",
      "x-github-id",
      "x-github-login",
    ];
    for (const name of identityHeaders) {
      let val: string | null = null;
      if (typeof request.headers.get === "function") {
        val = request.headers.get(name);
      } else {
        const raw = request.headers as unknown as Record<string, string>;
        const lower = name.toLowerCase();
        for (const k of Object.keys(raw)) {
          if (k.toLowerCase() === lower) {
            val = raw[k];
            break;
          }
        }
      }
      if (val && val.trim() !== "") {
        return true;
      }
    }
  }

  // 2. Check URL pathname for user-scoped endpoints
  const userPathRegex =
    /\/(watchlist|watchdog\/subscriptions|groups|api-keys|admin|contracts\/[^/]+\/notes|api\/push)(\/|$)/i;
  return userPathRegex.test(url.pathname);
}

/**
 * Workbox urlPattern callback matching public upstream Go API routes.
 * Handled with StaleWhileRevalidate in the service worker.
 *
 * Self-contained for workbox-build serialization.
 */
export function isCacheableUpstreamApi({
  url,
  request,
}: {
  url: URL;
  request?: Request;
}): boolean {
  // 1. Only cache GET and HEAD requests
  if (
    request &&
    request.method &&
    request.method !== "GET" &&
    request.method !== "HEAD"
  ) {
    return false;
  }

  // 2. Check that the request targets the upstream Go API
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
  if (!url.href.startsWith(apiBase)) {
    return false;
  }

  // 3. Exclude streaming and realtime connections
  if (url.pathname.includes("/stream") || url.pathname.endsWith("/subscribe")) {
    return false;
  }

  // 4. Check for user identity headers
  if (request && request.headers) {
    const identityHeaders = [
      "x-user-id",
      "authorization",
      "x-api-key",
      "x-github-id",
      "x-github-login",
    ];
    for (const name of identityHeaders) {
      let val: string | null = null;
      if (typeof request.headers.get === "function") {
        val = request.headers.get(name);
      } else {
        const raw = request.headers as unknown as Record<string, string>;
        const lower = name.toLowerCase();
        for (const k of Object.keys(raw)) {
          if (k.toLowerCase() === lower) {
            val = raw[k];
            break;
          }
        }
      }
      if (val && val.trim() !== "") {
        return false;
      }
    }
  }

  // 5. Exclude user-scoped paths
  const userPathRegex =
    /\/(watchlist|watchdog\/subscriptions|groups|api-keys|admin|contracts\/[^/]+\/notes)(\/|$)/i;
  if (userPathRegex.test(url.pathname)) {
    return false;
  }

  return true;
}

/**
 * Workbox urlPattern callback matching public internal Next.js API routes.
 * Handled with StaleWhileRevalidate in the service worker.
 *
 * Self-contained for workbox-build serialization.
 */
export function isCacheableInternalApi({
  url,
  request,
}: {
  url: URL;
  request?: Request;
}): boolean {
  // 1. Only cache GET and HEAD requests
  if (
    request &&
    request.method &&
    request.method !== "GET" &&
    request.method !== "HEAD"
  ) {
    return false;
  }

  // 2. Must be an internal /api/ route
  if (!url.pathname.startsWith("/api/")) {
    return false;
  }

  // 3. Exclude user-scoped internal routes (push subscriptions, etc.)
  const userInternalRegex = /\/api\/(push|user|auth)(\/|$)/i;
  if (userInternalRegex.test(url.pathname)) {
    return false;
  }

  // 4. Check for user identity headers
  if (request && request.headers) {
    const identityHeaders = [
      "x-user-id",
      "authorization",
      "x-api-key",
      "x-github-id",
      "x-github-login",
    ];
    for (const name of identityHeaders) {
      let val: string | null = null;
      if (typeof request.headers.get === "function") {
        val = request.headers.get(name);
      } else {
        const raw = request.headers as unknown as Record<string, string>;
        const lower = name.toLowerCase();
        for (const k of Object.keys(raw)) {
          if (k.toLowerCase() === lower) {
            val = raw[k];
            break;
          }
        }
      }
      if (val && val.trim() !== "") {
        return false;
      }
    }
  }

  return true;
}
