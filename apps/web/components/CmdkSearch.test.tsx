import "@testing-library/jest-dom/vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CmdkSearch } from "./CmdkSearch";
import * as api from "@/lib/api";
import * as networkMod from "@/lib/network";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock("@/lib/api", () => ({
  searchContracts: vi.fn(),
}));

vi.mock("./ThemeProvider", () => ({
  useTheme: () => ({
    theme: "dark",
    setTheme: vi.fn(),
  }),
}));

vi.mock("@/lib/network", () => ({
  useNetwork: () => ({
    network: "testnet",
    setNetwork: vi.fn(),
  }),
  networkFilter: (n: string) => (n === "all" ? undefined : n),
}));

describe("CmdkSearch (#619)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders mobile and desktop trigger buttons with accessible labels", () => {
    render(<CmdkSearch />);

    const mobileBtn = screen.getByRole("button", {
      name: /search contracts \(cmd\+k\)/i,
    });
    expect(mobileBtn).toBeInTheDocument();

    const desktopBtn = screen.getByText("Search contracts...");
    expect(desktopBtn).toBeInTheDocument();
  });

  it("opens palette on click and performs debounced search with network filter", async () => {
    vi.mocked(api.searchContracts).mockResolvedValueOnce({
      items: [
        {
          id: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          network: "testnet",
          label: "Vault Contract",
          status: "active",
          wasm_hash: null,
          backfill_complete_at: null,
          sync: null,
          storage_entry_count: 5,
          expiring_entry_count: 0,
          tags: ["vault"],
        },
      ],
    });

    render(<CmdkSearch />);

    const mobileBtn = screen.getByRole("button", {
      name: /search contracts \(cmd\+k\)/i,
    });
    fireEvent.click(mobileBtn);

    const input = screen.getByPlaceholderText(
      "Search contracts by ID or label..."
    );
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Vault" } });

    await waitFor(
      () => {
        expect(api.searchContracts).toHaveBeenCalledWith("Vault", {
          network: "testnet",
          limit: 10,
        });
      },
      { timeout: 1000 }
    );

    const resultItem = await screen.findByText("Vault Contract");
    expect(resultItem).toBeInTheDocument();

    fireEvent.click(resultItem);
    expect(mockPush).toHaveBeenCalledWith(
      "/contracts/CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    );
  });

  it("handles search error gracefully", async () => {
    vi.mocked(api.searchContracts).mockRejectedValueOnce(
      new Error("API offline")
    );

    render(<CmdkSearch />);

    const mobileBtn = screen.getByRole("button", {
      name: /search contracts \(cmd\+k\)/i,
    });
    fireEvent.click(mobileBtn);

    const input = screen.getByPlaceholderText(
      "Search contracts by ID or label..."
    );
    fireEvent.change(input, { target: { value: "Unknown" } });

    await waitFor(() => {
      expect(screen.getByText(/Error: API offline/i)).toBeInTheDocument();
    });
  });

  it("toggles palette on Cmd+K keyboard shortcut", () => {
    render(<CmdkSearch />);

    expect(
      screen.queryByPlaceholderText("Search contracts by ID or label...")
    ).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: "k", metaKey: true });

    expect(
      screen.getByPlaceholderText("Search contracts by ID or label...")
    ).toBeInTheDocument();
  });
});
