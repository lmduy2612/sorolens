# Frontend Performance Budget & Bundle Analysis Report

This document details the bundle analysis setup, performance budgets, image optimization migration, and CI enforcement for the Sorolens web dashboard (`@sorolens/web`).

---

## 1. Executive Summary

As Sorolens grows with additional monitoring, tracing, metrics visualizations, and contract tooling, maintaining fast initial page loads and small client bundles is critical for responsiveness and low indexer/API latency.

To ensure long-term performance:
- **Image Optimization**: Migrated all raw `<img>` tags across the application to Next.js `Image` (`next/image`) with explicit dimensions, intrinsic aspect ratios, responsive scaling, and LCP priority hinting.
- **Bundle Analyzer**: Integrated `@next/bundle-analyzer` into `apps/web/next.config.ts`, enabling interactive bundle inspection via `pnpm analyze`.
- **Performance Budgets**: Configured strict transfer and size limits in `apps/web/performance-budget.json` and `.lighthouserc.json`.
- **CI Enforcement**: Automated budget compliance checks via `apps/web/scripts/check-bundle-budget.mjs` directly in GitHub Actions (`.github/workflows/ci.yml`).

---

## 2. Image Optimization (`next/image` Adoption)

Plain `<img>` elements were identified and migrated to Next.js `Image` components:

| Location | Old Implementation | Updated Implementation | Benefit |
| :--- | :--- | :--- | :--- |
| `apps/web/app/page.tsx` | `<img src="/logo.svg" className="h-7 w-7" />` | `<Image src="/logo.svg" width={28} height={28} priority />` | Preloads above-the-fold logo, prevents layout shifts (CLS = 0). |
| `apps/web/app/(app)/layout.tsx` | `<img src="/logo.svg" className="h-8 w-8" />` | `<Image src="/logo.svg" width={32} height={32} priority />` | Eliminates header layout shift on dashboard routes. |
| `apps/web/app/(app)/watchdog/reports/page.tsx` | `<img src={badgeUrl} height={20} />` | `<Image src={badgeUrl} width={120} height={20} unoptimized />` | Correct aspect ratio and asynchronous decoding for dynamic SVG badges. |

---

## 3. Bundle Analysis Setup

The Next.js build pipeline is now equipped with `@next/bundle-analyzer`.

### Configuration (`apps/web/next.config.ts`)
```ts
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

export default withBundleAnalyzer(withPWA(...)(baseConfig));
```

### Running Bundle Analysis Locally
To generate interactive visual HTML treemaps of both client and server bundles:
```bash
# From repository root
pnpm analyze

# Or directly in apps/web
cd apps/web && pnpm run analyze
```
This opens browser reports displaying chunk compositions, module imports, and vendor footprints.

---

## 4. Performance Budgets

Performance budgets are configured in `apps/web/performance-budget.json` and mapped to Lighthouse CI via `.lighthouserc.json`.

### Defined Limits & Current Measurements

| Metric | Budget Limit | Current Build Value | Status |
| :--- | :--- | :--- | :--- |
| **Shared First Load JS** | 250 kB | 192 kB |  PASS |
| **Max Individual Chunk (Transfer)** | 250 kB | 135.2 kB |  PASS |
| **Max Route First Load JS** | 400 kB | 311.4 kB (`/contracts/[id]`) |  PASS |
| **Total Client Bundle Transfer** | 3.0 MB | 0.59 MB (across 59 chunks) |  PASS |

### Route Size Profile (Representative Samples)
- Landing page (`/`): ~198 kB First Load JS
- Contracts List (`/contracts`): ~207 kB First Load JS
- Live Stream (`/live`): ~296 kB First Load JS (includes EventSource stream state & charts)
- Contract Detail (`/contracts/[id]`): ~311 kB First Load JS (includes Recharts metrics, storage inspector, and changelog)
- Watchdog Reports (`/watchdog/reports`): ~199 kB First Load JS

---

## 5. Lighthouse CI Configuration

Lighthouse CI configuration is defined in `.lighthouserc.json`:
- Asserts minimum scores for Accessibility (>= 0.90), Best Practices (>= 0.90), Performance (>= 0.85), and SEO (>= 0.85).
- References `apps/web/performance-budget.json` for resource size and count limits.

---

## 6. Continuous Integration Enforcement

Budget enforcement is wired directly into `.github/workflows/ci.yml` in the `next-build` job:

```yaml
- name: Build dashboard
  working-directory: apps/web
  env:
    NEXT_PUBLIC_API_URL: http://localhost:8080
  run: pnpm build

- name: Check performance and bundle budget
  working-directory: apps/web
  run: pnpm run check:budget
```

If any chunk exceeds 250 kB, any route exceeds 400 kB, or total client JS exceeds 3 MB, the check fails with a detailed breakdown table and non-zero exit code.
