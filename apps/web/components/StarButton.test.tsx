import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { StarButton } from "./StarButton";
import * as api from "@/lib/api";

vi.mock("@/lib/api", () => ({
  addToWatchlist: vi.fn(),
  removeFromWatchlist: vi.fn(),
  watchlistStatus: vi.fn(),
}));

describe("StarButton", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem("sorolens_user_id", "test-user-id");
  });

  it("renders with initial unstarred state", () => {
    render(
      <StarButton
        contractId="CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        initialInWatchlist={false}
      />
    );

    const button = screen.getByTestId(
      "star-CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    );
    expect(button).toBeDefined();
    expect(button.getAttribute("aria-label")).toBe("Add to watchlist");
  });

  it("renders with initial starred state", () => {
    render(
      <StarButton
        contractId="CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        initialInWatchlist={true}
      />
    );

    const button = screen.getByTestId(
      "star-CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    );
    expect(button.getAttribute("aria-label")).toBe("Remove from watchlist");
  });

  it("calls addToWatchlist and shows success toast when starred", async () => {
    vi.mocked(api.addToWatchlist).mockResolvedValueOnce({ in_watchlist: true });
    const onToggle = vi.fn();

    render(
      <StarButton
        contractId="CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        initialInWatchlist={false}
        onToggle={onToggle}
        showToast
      />
    );

    const button = screen.getByTestId(
      "star-CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    );
    fireEvent.click(button);

    await waitFor(() => {
      expect(api.addToWatchlist).toHaveBeenCalledWith(
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        "test-user-id"
      );
    });

    expect(onToggle).toHaveBeenCalledWith(true);
    expect(button.getAttribute("aria-label")).toBe("Remove from watchlist");

    const toast = await screen.findByRole("status");
    expect(toast.textContent).toMatch(/Added to watchlist/i);
  });

  it("calls removeFromWatchlist and shows success toast when unstarred", async () => {
    vi.mocked(api.removeFromWatchlist).mockResolvedValueOnce({
      in_watchlist: false,
    });
    const onToggle = vi.fn();

    render(
      <StarButton
        contractId="CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        initialInWatchlist={true}
        onToggle={onToggle}
        showToast
      />
    );

    const button = screen.getByTestId(
      "star-CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    );
    fireEvent.click(button);

    await waitFor(() => {
      expect(api.removeFromWatchlist).toHaveBeenCalledWith(
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        "test-user-id"
      );
    });

    expect(onToggle).toHaveBeenCalledWith(false);
    expect(button.getAttribute("aria-label")).toBe("Add to watchlist");

    const toast = await screen.findByRole("status");
    expect(toast.textContent).toMatch(/Removed from watchlist/i);
  });

  it("handles errors gracefully and shows error toast when API fails", async () => {
    vi.mocked(api.addToWatchlist).mockRejectedValueOnce(
      new Error("Network error")
    );

    render(
      <StarButton
        contractId="CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        initialInWatchlist={false}
        showToast
      />
    );

    const button = screen.getByTestId(
      "star-CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    );
    fireEvent.click(button);

    await waitFor(() => {
      expect(api.addToWatchlist).toHaveBeenCalled();
    });

    // Should stay unstarred
    expect(button.getAttribute("aria-label")).toBe("Add to watchlist");

    // Should display error toast
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/Failed to add to watchlist/i);
  });

  it("fetches watchlistStatus when initialInWatchlist is not provided", async () => {
    vi.mocked(api.watchlistStatus).mockResolvedValueOnce({
      in_watchlist: true,
    });

    render(
      <StarButton contractId="CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" />
    );

    await waitFor(() => {
      expect(api.watchlistStatus).toHaveBeenCalledWith(
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        "test-user-id"
      );
    });

    const button = screen.getByTestId(
      "star-CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    );
    expect(button.getAttribute("aria-label")).toBe("Remove from watchlist");
  });
});
