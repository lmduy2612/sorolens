import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileNavDrawer } from "./MobileNavDrawer";

expect.extend(matchers);

// Mock sub-components that MobileNavDrawer imports
vi.mock("@/components/NetworkSelector", () => ({
  NetworkSelector: () => (
    <div data-testid="mock-network-selector">NetworkSelector</div>
  ),
}));

vi.mock("@/components/PushSubscribeButton", () => ({
  PushSubscribeButton: () => (
    <div data-testid="mock-push-btn">PushSubscribeButton</div>
  ),
}));

vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => <div data-testid="mock-theme-toggle">ThemeToggle</div>,
}));

afterEach(() => {
  cleanup();
});

describe("MobileNavDrawer", () => {
  it("renders hamburger trigger button initially closed", () => {
    render(<MobileNavDrawer />);
    const trigger = screen.getByTestId("mobile-menu-trigger");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens drawer on trigger click and closes on close button click", () => {
    render(<MobileNavDrawer />);
    const trigger = screen.getByTestId("mobile-menu-trigger");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");

    const closeBtn = screen.getByTestId("close-drawer-btn");
    fireEvent.click(closeBtn);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes drawer on backdrop click", () => {
    render(<MobileNavDrawer />);
    fireEvent.click(screen.getByTestId("mobile-menu-trigger"));

    const backdrop = screen.getByTestId("drawer-backdrop");
    fireEvent.click(backdrop);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes drawer and restores focus on Escape key", () => {
    render(<MobileNavDrawer />);
    const trigger = screen.getByTestId("mobile-menu-trigger");
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("dispatches sorolens:open-search event and closes drawer when search button clicked", () => {
    const searchListener = vi.fn();
    window.addEventListener("sorolens:open-search", searchListener);

    render(<MobileNavDrawer />);
    fireEvent.click(screen.getByTestId("mobile-menu-trigger"));

    const searchBtn = screen.getByTestId("drawer-search-btn");
    fireEvent.click(searchBtn);

    expect(searchListener).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();

    window.removeEventListener("sorolens:open-search", searchListener);
  });

  it("traps Tab focus within the drawer", () => {
    render(<MobileNavDrawer />);
    fireEvent.click(screen.getByTestId("mobile-menu-trigger"));

    const dialog = screen.getByRole("dialog");
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    expect(focusable.length).toBeGreaterThan(1);

    const firstEl = focusable[0];
    const lastEl = focusable[focusable.length - 1];

    // Focus last element and press Tab -> should wrap to first
    lastEl.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: false });
    expect(document.activeElement).toBe(firstEl);

    // Focus first element and press Shift+Tab -> should wrap to last
    firstEl.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(lastEl);
  });

  it("NEGATIVE: does not close drawer on unrelated key presses", () => {
    render(<MobileNavDrawer />);
    fireEvent.click(screen.getByTestId("mobile-menu-trigger"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Enter" });
    fireEvent.keyDown(document, { key: "Space" });
    fireEvent.keyDown(document, { key: "ArrowDown" });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
