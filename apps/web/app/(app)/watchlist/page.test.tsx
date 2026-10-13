import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
} from "@testing-library/react";
import WatchlistPage from "./page";
import * as api from "@/lib/api";

vi.mock("@/lib/api", () => ({
  listWatchlist: vi.fn(),
  addToWatchlist: vi.fn(),
  removeFromWatchlist: vi.fn(),
  watchlistStatus: vi.fn(),
}));

describe("WatchlistPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem("sorolens_user_id", "test-user-id");
  });

  it("renders empty state with link to contracts when watchlist is empty", async () => {
    vi.mocked(api.listWatchlist).mockResolvedValueOnce({
      items: [],
      total: 0,
    });

    render(<WatchlistPage />);

    expect(screen.getByTestId("watchlist-skeleton")).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText("No bookmarks yet")).toBeDefined();
    });

    expect(
      screen.getByText("Star a contract on the", { exact: false })
    ).toBeDefined();

    const link = screen.getByRole("link", { name: "Contracts page" });
    expect(link.getAttribute("href")).toBe("/contracts");
  });

  it("renders watchlist items in a table", async () => {
    vi.mocked(api.listWatchlist).mockResolvedValueOnce({
      items: [
        {
          contract_id:
            "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          user_id: "test-user-id",
          added_at: "2024-01-01T00:00:00Z",
        },
      ],
      total: 1,
    });

    render(<WatchlistPage />);

    await waitFor(() => {
      expect(screen.getByTestId("watchlist-table")).toBeDefined();
    });

    expect(
      screen.getByText(
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
      )
    ).toBeDefined();

    const link = screen.getByRole("link", {
      name: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    });
    expect(link.getAttribute("href")).toBe(
      "/contracts/CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    );

    const starBtn = screen.getByTestId(
      "star-CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    );
    expect(starBtn).toBeDefined();
    expect(starBtn.getAttribute("aria-label")).toBe("Remove from watchlist");
  });

  it("displays error state with retry button when API fails", async () => {
    vi.mocked(api.listWatchlist).mockRejectedValueOnce(
      new Error("Failed to fetch watchlist from server")
    );

    render(<WatchlistPage />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined();
    });

    expect(
      screen.getByText("Failed to fetch watchlist from server")
    ).toBeDefined();

    const retryBtn = screen.getByRole("button", { name: "Retry" });
    expect(retryBtn).toBeDefined();

    vi.mocked(api.listWatchlist).mockResolvedValueOnce({
      items: [
        {
          contract_id:
            "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
          user_id: "test-user-id",
          added_at: "2024-02-01T00:00:00Z",
        },
      ],
      total: 1,
    });

    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(
        screen.getByText(
          "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
        )
      ).toBeDefined();
    });
  });

  it("removes contract from list when unstarred", async () => {
    vi.mocked(api.listWatchlist).mockResolvedValueOnce({
      items: [
        {
          contract_id:
            "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          user_id: "test-user-id",
          added_at: "2024-01-01T00:00:00Z",
        },
      ],
      total: 1,
    });
    vi.mocked(api.removeFromWatchlist).mockResolvedValueOnce({
      in_watchlist: false,
    });

    render(<WatchlistPage />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        )
      ).toBeDefined();
    });

    const starBtn = screen.getByTestId(
      "star-CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    );
    fireEvent.click(starBtn);

    await waitFor(() => {
      expect(
        screen.queryByText(
          "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        )
      ).toBeNull();
    });

    // Should transition to empty state
    expect(screen.getByText("No bookmarks yet")).toBeDefined();
  });
});
