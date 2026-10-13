import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
} from "@testing-library/react";
import SLAReportsPage from "./page";
import * as api from "@/lib/api";

const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return {
    ...actual,
    listMonitoredContracts: vi.fn(),
    getContractReportHistory: vi.fn(),
  };
});

const sampleHistory = [
  {
    contract_id: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    month: "2024-01",
    total_checks: 100,
    healthy_checks: 99,
    uptime_pct: 99.0,
    incidents: 1,
    mttr_seconds: 300,
    total_downtime_seconds: 300,
    longest_outage_seconds: 300,
    ongoing_outage: false,
    critical_alerts: 1,
    warning_alerts: 0,
    info_alerts: 0,
    total_alerts: 1,
    first_check: "2024-01-01T00:00:00Z",
    last_check: "2024-01-31T23:59:59Z",
  },
  {
    contract_id: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    month: "2024-02",
    total_checks: 200,
    healthy_checks: 200,
    uptime_pct: 100.0,
    incidents: 0,
    mttr_seconds: 0,
    total_downtime_seconds: 0,
    longest_outage_seconds: 0,
    ongoing_outage: false,
    critical_alerts: 0,
    warning_alerts: 0,
    info_alerts: 0,
    total_alerts: 0,
    first_check: "2024-02-01T00:00:00Z",
    last_check: "2024-02-29T23:59:59Z",
  },
];

describe("SLAReportsPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    vi.mocked(api.listMonitoredContracts).mockResolvedValue({
      contracts: [
        {
          contract_id:
            "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          network: "testnet",
          name: "Oracle Contract",
          owner: "G1...",
          status: "healthy",
          check_interval: 60,
          registered_at: "2024-01-01T00:00:00Z",
        },
      ],
      total: 1,
    });
    vi.mocked(api.getContractReportHistory).mockResolvedValue({
      months: sampleHistory,
    });
  });

  it("renders empty state initially when no contract is selected", async () => {
    render(<SLAReportsPage />);

    expect(
      screen.getByText("Choose a contract to see its SLA report")
    ).toBeDefined();

    const csvBtn = screen.getByText("Export CSV");
    const pdfBtn = screen.getByText("Export PDF");
    const jsonBtn = screen.getByText("Export JSON");

    expect(csvBtn.getAttribute("aria-disabled")).toBe("true");
    expect(pdfBtn.getAttribute("aria-disabled")).toBe("true");
    expect(jsonBtn.getAttribute("aria-disabled")).toBe("true");
  });

  it("reads contract and month from deep link searchParams and loads report", async () => {
    mockSearchParams = new URLSearchParams({
      contract: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      month: "2024-02",
    });

    render(<SLAReportsPage />);

    await waitFor(() => {
      expect(api.getContractReportHistory).toHaveBeenCalledWith(
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        12
      );
    });

    // Uptime 100% metric card
    await waitFor(() => {
      expect(screen.getByText("100.000%")).toBeDefined();
    });

    // Chart rendered
    expect(screen.getByTestId("sla-history-chart")).toBeDefined();

    // Verify all 3 export links
    const csvBtn = screen.getByRole("link", { name: "Export CSV" });
    const pdfBtn = screen.getByRole("link", { name: "Export PDF" });
    const jsonBtn = screen.getByRole("link", { name: "Export JSON" });

    expect(csvBtn.getAttribute("href")).toContain(
      "/api/v1/reports/CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?month=2024-02&format=csv"
    );
    expect(pdfBtn.getAttribute("href")).toContain(
      "/api/v1/reports/CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?month=2024-02&format=pdf"
    );
    expect(jsonBtn.getAttribute("href")).toContain(
      "/api/v1/reports/CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?month=2024-02&format=json"
    );

    expect(csvBtn.getAttribute("download")).toBe(
      "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA-sla-2024-02.csv"
    );
    expect(jsonBtn.getAttribute("download")).toBe(
      "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA-sla-2024-02.json"
    );
  });

  it("updates selected month when clicking a bar in the history chart", async () => {
    mockSearchParams = new URLSearchParams({
      contract: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      month: "2024-02",
    });

    render(<SLAReportsPage />);

    await waitFor(() => {
      expect(screen.getByText("100.000%")).toBeDefined();
    });

    // Click January bar
    const janBar = screen.getByTestId("bar-2024-01");
    fireEvent.click(janBar);

    // Month changes to 2024-01, showing 99.000%
    await waitFor(() => {
      expect(screen.getByText("99.000%")).toBeDefined();
    });

    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("month=2024-01"),
      expect.anything()
    );
  });

  it("validates month format and shows error if invalid", async () => {
    mockSearchParams = new URLSearchParams({
      contract: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      month: "2024-02",
    });

    render(<SLAReportsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("sla-history-chart")).toBeDefined();
    });

    const monthInput = screen.getByLabelText("Month");
    fireEvent.change(monthInput, { target: { value: "invalid-month" } });

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toMatch(
        /Invalid month format|Month is required/i
      );
    });

    // Export buttons should be disabled
    const csvBtn = screen.getByText("Export CSV");
    expect(csvBtn.getAttribute("aria-disabled")).toBe("true");
  });

  it("allows selecting another contract from dropdown and updates URL", async () => {
    render(<SLAReportsPage />);

    await waitFor(() => {
      expect(screen.getByLabelText("Contract")).toBeDefined();
    });

    const select = screen.getByLabelText("Contract");
    fireEvent.change(select, {
      target: {
        value: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      },
    });

    await waitFor(() => {
      expect(api.getContractReportHistory).toHaveBeenCalledWith(
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        12
      );
    });

    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining(
        "contract=CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
      ),
      expect.anything()
    );
  });
});
