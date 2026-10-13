# Mobile Testing & Automated Accessibility (Axe Core)

This document outlines the Playwright mobile viewport projects, automated accessibility testing suite, and WCAG compliance audits for the Sorolens web dashboard (`@sorolens/web`).

---

## 1. Executive Summary

To prevent mobile layout regressions and maintain accessible experiences for all users:
- **Mobile Viewport Projects**: Configured multi-device test targets in `apps/web/playwright.config.ts` covering Desktop Chrome, Mobile Chrome (Google Pixel 5), and Mobile Safari (Apple iPhone 12).
- **Automated Axe Audits**: Integrated `@axe-core/playwright` across core routes to detect WCAG 2.1 AA violations automatically during end-to-end testing.
- **CI Automation**: Configured `.github/workflows/e2e.yml` to install both Chromium and WebKit browser binaries, running the multi-viewport suite on all PRs.

---

## 2. Playwright Multi-Device Project Matrix

Configured in `apps/web/playwright.config.ts`:

| Project Name | Device Preset | Viewport | Screen Density (DPR) | User Agent / Engine |
| :--- | :--- | :--- | :--- | :--- |
| `chromium` | Desktop Chrome | 1280 × 720 | 1.0x | Chromium Desktop |
| `mobile-chrome` | Pixel 5 | 393 × 851 | 2.75x | Chromium Mobile (Android) |
| `mobile-safari` | iPhone 12 | 390 × 844 | 3.0x | WebKit Mobile (iOS) |

Both mobile projects emulate touch interactions (`hasTouch: true`), mobile user agent strings, and high-DPI scaling.

---

## 3. Automated Accessibility Testing (`@axe-core/playwright`)

The test suite in `apps/web/tests/e2e/accessibility.spec.ts` audits key routes against WCAG 2.0 / 2.1 rulesets (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`).

### Audited Core Routes

| Route | View Tested | Key Elements Verified | Status |
| :--- | :--- | :--- | :--- |
| `/` | Landing Page | Hero headings, CTAs, feature cards, navigation links |  PASS |
| `/contracts` | Contracts Explorer | DataTable rows, column headers (`aria-sort`), search inputs, pagination |  PASS |
| `/contracts/[id]` | Contract Detail | Tab navigation, metrics charts, storage inspector, changelog feed |  PASS |
| `/live` | Live Activity | Real-time event feed, resume banner, event detail modal |  PASS |
| `/settings` | Settings & Identity | Form inputs, color theme radio buttons, API key copy widgets, status badges |  PASS |
| `/watchdog` | Watchdog Overview | Alert badges, health metrics, monitored contract cards |  PASS |
| `/watchdog/notifications` | Notifications Channels | Form inputs, channel selector chips, destination validation |  PASS |
| `/integrations` | Integrations Page | Slack, Discord, and Telegram setup cards, test send widgets, outbound links |  PASS |

### Violation Severity Thresholds
The `checkA11y(page)` helper filters scan results by impact level:
- **Critical** & **Serious**: Zero violations permitted. Any detected critical or serious violation immediately fails the test run with detailed locator metadata and WCAG rule links.
- **Moderate** & **Minor**: Tracked for ongoing design improvements (such as custom focus rings and contrast refinements).

---

## 4. Running Tests Locally

### Running the End-to-End Suite
```bash
# Run all projects (Desktop + Mobile)
pnpm --filter @sorolens/web test:e2e

# Run accessibility audits only
pnpm --filter @sorolens/web exec playwright test tests/e2e/accessibility.spec.ts

# Run on a specific mobile project
pnpm --filter @sorolens/web exec playwright test --project=mobile-chrome
pnpm --filter @sorolens/web exec playwright test --project=mobile-safari
```

### Running Unit & Configuration Tests
```bash
pnpm --filter @sorolens/web test tests/unit/accessibility-config.test.ts
```
