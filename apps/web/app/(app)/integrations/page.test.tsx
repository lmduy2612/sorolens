import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import IntegrationsPage from "./page";
import NotificationsPage from "../watchdog/notifications/page";

vi.mock("@/lib/api", () => ({
  listSubscriptions: vi.fn().mockResolvedValue({ subscriptions: [] }),
  listMonitoredContracts: vi.fn().mockResolvedValue({ contracts: [] }),
  createSubscription: vi.fn().mockResolvedValue({}),
  deleteSubscription: vi.fn().mockResolvedValue(undefined),
}));

describe("IntegrationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders heading and link to watchdog notifications", () => {
    render(<IntegrationsPage />);

    expect(screen.getByRole("heading", { name: "Integrations" })).toBeTruthy();
    expect(
      screen.getByText(/Connect Slack, Discord, and Telegram/i)
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Manage Watchdog Notifications/i })
    ).toBeTruthy();
  });

  it("documents each integration (Slack, Discord, Telegram)", () => {
    render(<IntegrationsPage />);

    expect(screen.getByTestId("integration-card-slack")).toBeTruthy();
    expect(screen.getByTestId("integration-card-discord")).toBeTruthy();
    expect(screen.getByTestId("integration-card-telegram")).toBeTruthy();

    expect(screen.getByTestId("status-slack").textContent).toBe("Available");
    expect(screen.getByTestId("status-discord").textContent).toBe("Available");
    expect(screen.getByTestId("status-telegram").textContent).toBe("Available");

    // Install links
    const slackLink = screen.getByTestId("install-link-slack");
    expect(slackLink.getAttribute("href")).toContain("slack.com");

    const discordLink = screen.getByTestId("install-link-discord");
    expect(discordLink.getAttribute("href")).toContain("discord.gg");

    const telegramLink = screen.getByTestId("install-link-telegram");
    expect(telegramLink.getAttribute("href")).toContain("t.me");
  });

  it("sends a test message successfully and renders status feedback", async () => {
    render(<IntegrationsPage />);

    const sendBtn = screen.getByTestId("test-send-button-slack");
    fireEvent.click(sendBtn);

    await waitFor(() => {
      const success = screen.getByTestId("test-success-slack");
      expect(success.textContent).toMatch(/Test message successfully sent/i);
    });
  });

  it("surfaces validation error when target input is invalid", async () => {
    render(<IntegrationsPage />);

    const input = screen.getByTestId("test-input-slack");
    fireEvent.change(input, { target: { value: "invalid-url" } });

    const sendBtn = screen.getByTestId("test-send-button-slack");
    fireEvent.click(sendBtn);

    await waitFor(() => {
      const err = screen.getByTestId("test-error-slack");
      expect(err.textContent).toMatch(/Invalid Slack webhook URL/i);
    });
  });

  it("links to integrations from the watchdog notifications page", async () => {
    render(<NotificationsPage />);

    await waitFor(() => {
      const link = screen.getByTestId("integrations-guide-link");
      expect(link.getAttribute("href")).toBe("/integrations");
    });
  });
});
