/**
 * Tests for apps/web/app/(app)/contracts/[id]/page.tsx
 *
 * Verifies Issue #617:
 * - Tabs accessible (WAI-ARIA tablist, tab, tabpanel) and deep-linkable (?tab=...)
 * - Invocations table with function and status filters
 * - Cross-links to compare and watchdog
 * - Browser back/forward (popstate) reaction
 */

import * as matchers from "@testing-library/jest-dom/matchers";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock next/link ──────────────────────────────────────────────────────────
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// ── Mock next/navigation ────────────────────────────────────────────────────
const nav = vi.hoisted(() => {
  let query = new URLSearchParams("");
  const replace = vi.fn((href: string) => {
    query = new URLSearchParams(href.startsWith("?") ? href.slice(1) : href);
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", href);
    }
  });
  const push = vi.fn();
  return {
    replace,
    push,
    getQuery: () => query,
    setQuery: (q: string | URLSearchParams) => {
      query = new URLSearchParams(q);
      if (typeof window !== "undefined") {
        const s = query.toString();
        const base = "/contracts/" + CONTRACT_ID;
        window.history.replaceState({}, "", s ? `${base}?${s}` : base);
      }
    },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
  useSearchParams: () => nav.getQuery(),
  usePathname: () => "/contracts/" + CONTRACT_ID,
  notFound: vi.fn(),
}));

// ── Mock @sorolens/ui ───────────────────────────────────────────────────────
vi.mock("@sorolens/ui", () => ({
  MonoId: ({ value }: { value: string }) => (
    <span data-testid="mono-id">{value}</span>
  ),
  CopyButton: ({ text, label }: { text: string; label: string }) => (
    <button type="button" aria-label={label} data-copy={text}>
      copy
    </button>
  ),
}));

// ── Mock api ────────────────────────────────────────────────────────────────
const mockGetContract = vi.fn();
const mockGetContractEvents = vi.fn();
const mockGetContractStorage = vi.fn();
const mockGetContractStats = vi.fn();
const mockListInvocations = vi.fn();
const mockGetMonitoredContract = vi.fn();
const mockGetContractUptime = vi.fn();
const mockListHealthChecks = vi.fn();
const mockListAlerts = vi.fn();

vi.mock("@/lib/api", () => ({
  getContract: (...args: unknown[]) => mockGetContract(...args),
  getContractEvents: (...args: unknown[]) => mockGetContractEvents(...args),
  getContractStorage: (...args: unknown[]) => mockGetContractStorage(...args),
  getContractStats: (...args: unknown[]) => mockGetContractStats(...args),
  listInvocations: (...args: unknown[]) => mockListInvocations(...args),
  getMonitoredContract: (...args: unknown[]) =>
    mockGetMonitoredContract(...args),
  getContractUptime: (...args: unknown[]) => mockGetContractUptime(...args),
  listHealthChecks: (...args: unknown[]) => mockListHealthChecks(...args),
  listAlerts: (...args: unknown[]) => mockListAlerts(...args),
  addContractTag: vi.fn(),
  removeContractTag: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string
    ) {
      super(message);
      this.name = "ApiError";
    }
  },
}));

vi.mock("@/lib/resourceTrend", () => ({
  getResourceTrend: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/hooks/useEventStream", () => ({
  useEventStream: () => ({ isConnected: false }),
}));

// Mock chart components for jsdom
vi.mock("@/components/EventVolumeChart", () => ({
  EventVolumeChart: () => <div data-testid="event-volume-chart">Chart</div>,
}));
vi.mock("@/components/InvocationChart", () => ({
  InvocationChart: () => <div data-testid="invocation-chart">Chart</div>,
}));
vi.mock("@/components/AddToGroup", () => ({
  AddToGroup: () => <div data-testid="add-to-group">AddToGroup</div>,
}));
vi.mock("@/components/VerifiedBadge", () => ({
  VerifiedBadge: () => <div data-testid="verified-badge">Verified</div>,
}));
vi.mock("@/components/CallTracePanel", () => ({
  CallTracePanel: () => <div data-testid="call-trace-panel">CallTrace</div>,
}));
vi.mock("@/components/ContractNotesPanel", () => ({
  ContractNotesPanel: () => <div data-testid="notes-panel">Notes</div>,
}));
vi.mock("@/components/SnapshotPanel", () => ({
  SnapshotPanel: () => <div data-testid="snapshot-panel">Snapshot</div>,
}));
vi.mock("@/components/HealthScoreCard", () => ({
  HealthScoreCard: () => <div data-testid="health-score-card">HealthScore</div>,
}));

expect.extend(matchers);

// ── Fixtures ─────────────────────────────────────────────────────────────────

const CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const MOCK_CONTRACT = {
  id: CONTRACT_ID,
  network: "testnet",
  label: "Swap Router",
  status: "active",
  tags: ["prod", "defi"],
  sync: {
    last_ledger: 123456,
    last_run_at: "2026-10-10T12:00:00Z",
  },
};

const MOCK_STATS = {
  window: "7d",
  stats: {
    total_events: 1200,
    total_invocations: 450,
    storage_entry_count: 85,
    expiring_entry_count: 3,
  },
  event_volume: [],
  invocation_count: [],
};

const MOCK_INVOCATIONS = [
  {
    tx_hash: "tx_hash_111111",
    contract_id: CONTRACT_ID,
    network: "testnet",
    ledger: 1001,
    ledger_closed_at: "2026-10-10T10:00:00Z",
    status: "success",
    function_name: "swap_exact_tokens",
    args_decoded: { amount_in: 100, min_amount_out: 95 },
    result_decoded: { amount_out: 98 },
    resource_fee_charged: 1500,
    cpu_insn: 450000,
    mem_byte: 12000,
    ledger_read_byte: 512,
    ledger_write_byte: 256,
  },
  {
    tx_hash: "tx_hash_222222",
    contract_id: CONTRACT_ID,
    network: "testnet",
    ledger: 1002,
    ledger_closed_at: "2026-10-10T11:00:00Z",
    status: "failed",
    function_name: "add_liquidity",
    args_decoded: { token_a: "USDC", amount: 50 },
    result_decoded: null,
    resource_fee_charged: 2200,
    cpu_insn: 320000,
    mem_byte: 8500,
    ledger_read_byte: 256,
    ledger_write_byte: 0,
  },
];

const MOCK_EVENTS = [
  {
    id: "evt_1",
    contract_id: CONTRACT_ID,
    type: "contract",
    topic_xdr: "AAAAAA==",
    topic_decoded: ["swap"],
    value_xdr: "BBBBBB==",
    value_decoded: { amount: 50 },
    ledger: 1001,
    ledger_closed_at: "2026-10-10T10:00:00Z",
    tx_hash: "tx_hash_111111",
    in_successful_call: true,
  },
];

const MOCK_STORAGE = {
  entries: [
    {
      key_xdr: "key1",
      durability: "persistent",
      live_until_ledger: 200000,
      last_modified_ledger: 100000,
    },
  ],
  cursor: null,
  has_more: false,
  current_ledger: 123456,
};

const MOCK_MONITORED = {
  contract_id: CONTRACT_ID,
  network: "testnet",
  status: "Healthy" as const,
  last_check_at: "2026-10-10T12:00:00Z",
  total_checks: 100,
  uptime_pct: 99.8,
  created_at: "2026-09-01T00:00:00Z",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ContractDetailPage Tabs & Invocations (#617)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nav.setQuery("");

    mockGetContract.mockResolvedValue(MOCK_CONTRACT);
    mockGetContractStats.mockResolvedValue(MOCK_STATS);
    mockGetContractEvents.mockResolvedValue({
      events: MOCK_EVENTS,
      cursor: null,
      has_more: false,
    });
    mockGetContractStorage.mockResolvedValue(MOCK_STORAGE);
    mockListInvocations.mockResolvedValue({
      invocations: MOCK_INVOCATIONS,
      next_cursor: null,
    });
    mockGetMonitoredContract.mockResolvedValue(MOCK_MONITORED);
    mockGetContractUptime.mockResolvedValue({
      contract_id: CONTRACT_ID,
      window: "24h",
      uptime_pct: 99.9,
    });
    mockListHealthChecks.mockResolvedValue({
      checks: [
        {
          tx_hash: "tx_hc_1",
          status: "Healthy",
          timestamp: "2026-10-10T11:55:00Z",
          latency_ms: 120,
        },
      ],
      next_cursor: "",
    });
    mockListAlerts.mockResolvedValue({
      alerts: [],
      next_cursor: "",
    });
  });

  afterEach(() => {
    cleanup();
  });

  const PARAMS_PROMISE = Promise.resolve({ id: CONTRACT_ID });
  (PARAMS_PROMISE as any).status = "fulfilled";
  (PARAMS_PROMISE as any).value = { id: CONTRACT_ID };

  async function renderPage(params = PARAMS_PROMISE) {
    const { default: ContractDetailPage } =
      await import("@/app/(app)/contracts/[id]/page");
    return render(<ContractDetailPage params={params} />);
  }

  // ── Tablist and accessibility ──────────────────────────────────────────────

  it("renders an accessible tablist with all 5 tabs and defaults to Overview", async () => {
    await renderPage();
    await waitFor(() => screen.getByTestId("panel-overview"));

    const tablist = screen.getByRole("tablist", {
      name: /contract navigation/i,
    });
    expect(tablist).toBeInTheDocument();

    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBe(5);

    const labels = tabs.map((t) => t.textContent?.trim());
    expect(labels).toEqual([
      "Overview",
      "Events",
      "Invocations",
      "Storage",
      "Watchdog",
    ]);

    // Overview tab is active by default
    const overviewTab = screen.getByTestId("tab-overview");
    expect(overviewTab).toHaveAttribute("aria-selected", "true");

    const eventsTab = screen.getByTestId("tab-events");
    expect(eventsTab).toHaveAttribute("aria-selected", "false");

    // Overview panel is rendered and labelled by tab-overview
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("id", "panel-overview");
    expect(panel).toHaveAttribute("aria-labelledby", "tab-overview");
    expect(screen.getByText("Total indexed")).toBeInTheDocument();
  });

  // ── Deep linking on load ───────────────────────────────────────────────────

  it("activates the Invocations tab directly when deep-linked via URL query (?tab=invocations)", async () => {
    nav.setQuery("?tab=invocations");

    await renderPage();
    await waitFor(() => screen.getByTestId("panel-invocations"));
    await waitFor(() => screen.getByTestId("contract-invocations-table"));

    const invocationsTab = screen.getByTestId("tab-invocations");
    expect(invocationsTab).toHaveAttribute("aria-selected", "true");

    const overviewTab = screen.getByTestId("tab-overview");
    expect(overviewTab).toHaveAttribute("aria-selected", "false");

    expect(screen.getByText("swap_exact_tokens")).toBeInTheDocument();
  });

  // ── Deep linking on tab click ──────────────────────────────────────────────

  it("switches tabs and updates URL on tab click", async () => {
    await renderPage();
    await waitFor(() => screen.getByTestId("panel-overview"));
    nav.replace.mockClear();

    // Click Invocations tab
    fireEvent.click(screen.getByTestId("tab-invocations"));

    await waitFor(() => screen.getByTestId("panel-invocations"));
    expect(nav.replace).toHaveBeenCalledWith(
      expect.stringContaining("tab=invocations"),
      expect.objectContaining({ scroll: false })
    );
    expect(screen.getByTestId("tab-invocations")).toHaveAttribute(
      "aria-selected",
      "true"
    );

    // Click Storage tab
    fireEvent.click(screen.getByTestId("tab-storage"));
    await waitFor(() => screen.getByTestId("panel-storage"));
    expect(nav.replace).toHaveBeenCalledWith(
      expect.stringContaining("tab=storage"),
      expect.objectContaining({ scroll: false })
    );

    // Click Overview tab (removes tab param for clean URL)
    fireEvent.click(screen.getByTestId("tab-overview"));
    await waitFor(() => screen.getByTestId("panel-overview"));
    expect(screen.getByTestId("tab-overview")).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  // ── Popstate (Back/Forward) navigation ─────────────────────────────────────

  it("switches active tab on browser popstate navigation", async () => {
    await renderPage();
    await waitFor(() => screen.getByTestId("panel-overview"));

    // User navigates back to ?tab=watchdog
    nav.setQuery("?tab=watchdog");
    window.dispatchEvent(new PopStateEvent("popstate"));

    await waitFor(() => screen.getByTestId("panel-watchdog"));
    expect(screen.getByTestId("tab-watchdog")).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  // ── Cross links ────────────────────────────────────────────────────────────

  it("renders cross-links to Compare and Watchdog in header", async () => {
    await renderPage();
    await waitFor(() => screen.getByTestId("panel-overview"));

    const compareLink = screen.getByTestId("link-compare");
    expect(compareLink).toHaveAttribute("href", `/compare?ids=${CONTRACT_ID}`);

    const watchdogLink = screen.getByTestId("link-watchdog");
    expect(watchdogLink).toHaveAttribute("href", `/watchdog/${CONTRACT_ID}`);
  });

  // ── Invocations table and filters ──────────────────────────────────────────

  it("renders invocations table with function and status filters", async () => {
    nav.setQuery("?tab=invocations");
    await renderPage();
    await waitFor(() => screen.getByTestId("contract-invocations-table"));

    // Invocations are loaded for this contract
    expect(mockListInvocations).toHaveBeenCalledWith(
      expect.objectContaining({ contract_id: CONTRACT_ID })
    );

    // Rows render with function names and statuses
    expect(screen.getByText("swap_exact_tokens")).toBeInTheDocument();
    expect(screen.getByText("add_liquidity")).toBeInTheDocument();
    expect(screen.getByText("Success")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();

    // Filter by function name
    const fnInput = screen.getByTestId("invocations-fn-filter");
    fireEvent.change(fnInput, { target: { value: "swap" } });

    await waitFor(() => {
      expect(mockListInvocations).toHaveBeenLastCalledWith(
        expect.objectContaining({
          contract_id: CONTRACT_ID,
          fn: "swap",
        })
      );
    });

    // Filter by status (Failed only)
    const statusSelect = screen.getByTestId("invocations-status-filter");
    fireEvent.change(statusSelect, { target: { value: "failed" } });

    await waitFor(() => {
      expect(mockListInvocations).toHaveBeenLastCalledWith(
        expect.objectContaining({
          contract_id: CONTRACT_ID,
          status: "failed",
        })
      );
    });

    // Clear filters button appears and resets filters
    const clearBtn = screen.getByTestId("invocations-clear-filters");
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(fnInput).toHaveValue("");
      expect(statusSelect).toHaveValue("all");
    });
  });

  it("expands invocation row on click to show decoded arguments and result", async () => {
    nav.setQuery("?tab=invocations");
    await renderPage();
    await waitFor(() => screen.getByTestId("contract-invocations-table"));

    const row = screen.getByTestId("invocation-row-tx_hash_111111");
    fireEvent.click(row);

    // Reveals Decoded Arguments and Decoded Result
    expect(screen.getByText("Decoded Arguments")).toBeInTheDocument();
    expect(screen.getByText(/min_amount_out/)).toBeInTheDocument();
    expect(screen.getByText("Decoded Result")).toBeInTheDocument();
    expect(screen.getAllByText(/amount_out/).length).toBeGreaterThanOrEqual(1);
  });

  // ── Watchdog tab ───────────────────────────────────────────────────────────

  it("renders watchdog tab with health badge, uptime, and cross-link", async () => {
    nav.setQuery("?tab=watchdog");
    await renderPage();
    await waitFor(() => screen.getByTestId("watchdog-panel-content"));

    expect(screen.getAllByText("Healthy").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("24h Uptime")).toBeInTheDocument();
    expect(screen.getByText("7d Uptime")).toBeInTheDocument();
    expect(screen.getByText("30d Uptime")).toBeInTheDocument();

    const fullWatchdogLink = screen.getByTestId("watchdog-detail-link");
    expect(fullWatchdogLink).toHaveAttribute(
      "href",
      `/watchdog/${CONTRACT_ID}`
    );
  });

  it("handles unmonitored contract in watchdog tab with enrollment prompt", async () => {
    mockGetMonitoredContract.mockRejectedValueOnce(
      new (class ApiError extends Error {
        status = 404;
      })("Not found")
    );

    nav.setQuery("?tab=watchdog");
    await renderPage();
    await waitFor(() => screen.getByTestId("watchdog-unmonitored-state"));

    expect(
      screen.getByText(
        /This contract is not currently enrolled in active Watchdog monitoring/i
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId("watchdog-setup-btn")).toHaveAttribute(
      "href",
      `/watchdog/${CONTRACT_ID}`
    );
  });
});
