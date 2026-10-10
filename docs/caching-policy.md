# Service Worker Caching Policy & User Data Isolation

**Issue Reference:** #615  
**Scope:** `apps/web/worker/routing.ts`, `apps/web/next.config.ts`, `apps/web/public/manifest.webmanifest`, `apps/web/public/manifest.json`

---

## 1. Overview & Threat Model

Sorolens provides Progressive Web App (PWA) capabilities enabling offline browsing of smart contracts, network events, and watchdog statistics. The service worker is built using Workbox via `@ducanh2912/next-pwa`.

### The Problem (Issue #615)

Standard browser `CacheStorage` keys cached HTTP responses by `request.url` and does not automatically partition caches by custom request headers such as `X-User-ID` or `Authorization`.

In a shared browser environment (e.g. shared workstations, public computers, or switching accounts on the same device):

- If user-scoped responses (e.g. watchlist, watchdog alert subscriptions, contract portfolios/groups, or contract notes) were stored in the shared runtime cache, a subsequent user navigating to those URLs could be served stale responses containing the previous user's private data.
- Watchlist and subscription endpoints hold user configurations and integration credentials.

---

## 2. Policy & Routing Rules

The PWA service worker enforces strict isolation rules configured in `apps/web/worker/routing.ts` and registered in `apps/web/next.config.ts`:

### A. User-Scoped & Authenticated Endpoints (`NetworkOnly`)

Any request meeting **either** of the following conditions is handled with `NetworkOnly` and **MUST NEVER** be placed in the cache:

1. **User Identity Headers:** Any request carrying non-empty identity headers:
   - `X-User-ID`
   - `Authorization`
   - `X-API-Key`
   - `X-GitHub-ID` / `X-GitHub-Login`
2. **User-Scoped URL Patterns:**
   - Watchlist: `/api/v1/watchlist` and sub-routes (e.g. status)
   - Alert Subscriptions: `/api/v1/watchdog/subscriptions` and sub-routes
   - Groups / Portfolios: `/api/v1/groups` and sub-routes
   - Contract Notes: `/api/v1/contracts/:id/notes`
   - API Key & Admin Management: `/api/v1/api-keys`, `/api/v1/admin/*`, `/admin/*`
   - Internal Web Push Subscriptions: `/api/push/*`

### B. Streaming & Realtime Endpoints (`NetworkOnly`)

Real-time continuous connections cannot be cached:

- Server-Sent Events (SSE): `/stream/*` (e.g. `/api/v1/stream/events`, `/api/v1/contracts/:id/stream`)
- WebSockets: `/api/v1/subscribe`
- Any request with `Accept: text/event-stream`

### C. Mutation Methods (`NetworkOnly`)

- All non-GET/HEAD HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`) mutate server state and bypass caching.

### D. Public Anonymous Endpoints (`StaleWhileRevalidate`)

Only public, unauthenticated, idempotent GET/HEAD requests are eligible for caching:

- Public Upstream API (`cacheName: "sorolens-upstream-api-cache"`, 5-minute TTL, max 400 entries):
  - `/api/v1/contracts` and contract inspection routes
  - `/api/v1/events` and `/api/v1/events/recent`
  - `/api/v1/stats/global` and `/api/v1/stats/activity`
  - `/api/v1/watchdog/stats` and public alerts
  - `/api/v1/search`, `/api/v1/compare`, `/api/v1/rules`
- Public Internal API (`cacheName: "sorolens-api-cache"`, 5-minute TTL, max 200 entries):
  - Public Next.js route handlers (e.g. `/api/version`, `/api/health`).

---

## 3. Web App Manifest Validation

The W3C Web App Manifest requires valid screenshot preview assets for rich install prompts:

- Screenshots must point to valid screenshot image files (e.g. `/screenshots/dashboard-narrow.png` and `/screenshots/dashboard-wide.png`), **not icon files**.
- The `sizes` property must match the physical pixel dimensions of the image asset.
- Both `narrow` (portrait/mobile) and `wide` (landscape/desktop) form factors are declared.

---

## 4. Test Verification

Routing and isolation rules are verified by automated tests in `apps/web/worker/routing.test.ts` and `apps/web/app/layout.test.ts`:

- Unit tests covering all user paths, header combinations, case insensitivity, mutation methods, and streaming exclusions.
- Manifest asset tests verifying existence, PNG magic bytes, dimensions, and absence of icon pointers.
