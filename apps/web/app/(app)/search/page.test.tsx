import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import SearchPage from "./page";
import * as api from "@/lib/api";

let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/lib/api", () => ({
  searchContracts: vi.fn(),
}));

vi.mock("@/lib/network", () => ({
  useNetwork: () => ({
    network: "all",
    setNetwork: vi.fn(),
  }),
  networkFilter: () => undefined,
}));

describe("SearchPage (/search) (#619)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders empty initial prompt when no query is present", () => {
    render(<SearchPage />);

    expect(screen.getByText("Search Results")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Enter a contract ID, label, or 64-character transaction hash above to begin searching/i
      )
    ).toBeInTheDocument();
  });

  it("searches and renders matching contracts when query param is provided", async () => {
    mockSearchParams = new URLSearchParams("q=AMM");

    vi.mocked(api.searchContracts).mockResolvedValueOnce({
      items: [
        {
          id: "CAMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM",
          network: "mainnet",
          label: "AMM Liquidity Pool",
          status: "active",
          wasm_hash: null,
          backfill_complete_at: null,
          sync: null,
          storage_entry_count: 120,
          expiring_entry_count: 5,
          tags: ["dex", "amm"],
        },
      ],
    });

    render(<SearchPage />);

    await waitFor(() => {
      expect(api.searchContracts).toHaveBeenCalledWith("AMM", {
        network: undefined,
        limit: 25,
      });
    });

    expect(await screen.findByText("AMM Liquidity Pool")).toBeInTheDocument();
    expect(
      screen.getByText(
        "CAMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM"
      )
    ).toBeInTheDocument();
    expect(screen.getByText("#dex")).toBeInTheDocument();
    expect(screen.getByText("#amm")).toBeInTheDocument();
  });

  it("detects 64-character transaction hash and displays event link", async () => {
    const txHash =
      "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    mockSearchParams = new URLSearchParams(`q=${txHash}`);

    vi.mocked(api.searchContracts).mockResolvedValueOnce({ items: [] });

    render(<SearchPage />);

    expect(
      await screen.findByText(/Transaction Hash Detected/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /View Events for Transaction →/i })
    ).toHaveAttribute("href", `/events?tx_hash=${txHash}`);
  });

  it("displays empty state when no matching contracts are returned", async () => {
    mockSearchParams = new URLSearchParams("q=NonExistentContract");

    vi.mocked(api.searchContracts).mockResolvedValueOnce({ items: [] });

    render(<SearchPage />);

    expect(
      await screen.findByText("No matching contracts found")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Track new contract/i })
    ).toHaveAttribute("href", "/contracts/new");
  });
});
