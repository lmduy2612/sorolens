/**
 * Tests for ContractChangelogPage (issue #601)
 */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ContractChangelogPage from "./page";
import * as api from "@/lib/api";
import type { ContractDetail, ContractVersionEntry } from "@/lib/types";

// Mock next/navigation
const mockNotFound = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

describe("ContractChangelogPage", () => {
  const contractId = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockContract: ContractDetail = {
    contract_id: contractId,
    network: "testnet",
    status: "active",
    label: "Treasury Vault",
    added_at: "2026-01-01T00:00:00Z",
  };

  const mockEntries: ContractVersionEntry[] = [
    {
      id: 1,
      contract_id: contractId,
      wasm_hash:
        "1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff",
      first_seen_ledger: 100000,
      recorded_at: "2026-01-01T12:00:00Z",
    },
    {
      id: 2,
      contract_id: contractId,
      wasm_hash:
        "aaaabbbbccccddddeeeeffff1111222233334444555566667777888899990000",
      first_seen_ledger: 200000,
      tx_hash: "tx1234567890abcdef",
      verified_source_ref: "https://github.com/sorolens/example/tree/v2",
      recorded_at: "2026-02-01T12:00:00Z",
    },
  ];

  it("renders changelog page with header, integrations cards, and timeline entries", async () => {
    vi.spyOn(api, "getContract").mockResolvedValue(mockContract);
    vi.spyOn(api, "getContractChangelog").mockResolvedValue(mockEntries);

    render(<ContractChangelogPage id={contractId} />);

    await waitFor(() => {
      expect(screen.getByText("Wasm Changelog")).toBeDefined();
    });

    expect(screen.getByText("Treasury Vault")).toBeDefined();

    // Check integration cards
    expect(screen.getByText("Atom / RSS Feed")).toBeDefined();
    expect(screen.getByText("Embeddable SVG Badge")).toBeDefined();
    expect(screen.getByTestId("changelog-integrations")).toBeDefined();

    // Check timeline rendered
    await waitFor(() => {
      expect(screen.getAllByTestId("changelog-entry").length).toBe(2);
    });

    // Check verified source ref link
    const sourceLink = screen.getByRole("link", {
      name: "https://github.com/sorolens/example/tree/v2",
    });
    expect(sourceLink).toBeDefined();
    expect(sourceLink.getAttribute("href")).toBe(
      "https://github.com/sorolens/example/tree/v2"
    );
  });

  it("renders empty state when there are no changelog entries", async () => {
    vi.spyOn(api, "getContract").mockResolvedValue(mockContract);
    vi.spyOn(api, "getContractChangelog").mockResolvedValue([]);

    render(<ContractChangelogPage id={contractId} />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "No Wasm hash transitions have been recorded for this contract yet."
        )
      ).toBeDefined();
    });
  });

  it("renders error alert with retry button when changelog fails to load", async () => {
    vi.spyOn(api, "getContract").mockResolvedValue(mockContract);
    const changelogSpy = vi
      .spyOn(api, "getContractChangelog")
      .mockRejectedValueOnce(new Error("Connection reset by peer"))
      .mockResolvedValueOnce(mockEntries);

    render(<ContractChangelogPage id={contractId} />);

    await waitFor(() => {
      expect(screen.getByTestId("changelog-error")).toBeDefined();
    });
    expect(screen.getByText("Connection reset by peer")).toBeDefined();

    const retryBtn = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getAllByTestId("changelog-entry").length).toBe(2);
    });
    expect(changelogSpy).toHaveBeenCalledTimes(2);
  });

  it("triggers notFound when contract returns 404", async () => {
    vi.spyOn(api, "getContract").mockRejectedValue(
      new api.ApiError(404, "not found")
    );
    vi.spyOn(api, "getContractChangelog").mockResolvedValue([]);

    render(<ContractChangelogPage id={contractId} />);

    await waitFor(() => {
      expect(mockNotFound).toHaveBeenCalled();
    });
  });
});
