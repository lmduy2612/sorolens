/**
 * Tests for ContractUpgradesTimeline component (issue #603)
 */

import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContractUpgradesTimeline } from "./ContractUpgradesTimeline";
import * as api from "@/lib/api";
import type { ContractUpgrade, ContractVerification } from "@/lib/types";

describe("ContractUpgradesTimeline", () => {
  const contractId = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockUpgrades: ContractUpgrade[] = [
    {
      contract_id: contractId,
      from_hash:
        "aaaa1111222233334444555566667777888899990000aaaabbbbccccddddeeee",
      to_hash:
        "bbbb1111222233334444555566667777888899990000aaaabbbbccccddddeeee",
      ledger: 1045200,
      tx_hash:
        "tx9999888877776666555544443333222211110000aaaabbbbccccddddeeeeffff",
      at: "2026-03-01T14:30:00Z",
      verified_source_ref: "https://github.com/sorolens/contracts/tree/v2.0.0",
    },
    {
      contract_id: contractId,
      from_hash: "",
      to_hash:
        "aaaa1111222233334444555566667777888899990000aaaabbbbccccddddeeee",
      ledger: 980100,
      tx_hash:
        "tx1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff",
      at: "2026-01-15T10:00:00Z",
    },
  ];

  it("renders chronological upgrade entries with hashes, ledgers, and dates", async () => {
    vi.spyOn(api, "getContractUpgrades").mockResolvedValue({
      upgrades: mockUpgrades,
    });
    vi.spyOn(api, "getContractVerification").mockResolvedValue({
      contract_id: contractId,
      status: "unverified",
      matched: false,
      source: { kind: "git" },
      toolchain: {},
      diagnostics: [],
      submitted_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });

    render(<ContractUpgradesTimeline contractId={contractId} />);

    // Wait for timeline
    await waitFor(() => {
      expect(screen.getByTestId("upgrades-timeline")).toBeDefined();
    });

    const entries = screen.getAllByTestId("upgrade-entry");
    expect(entries.length).toBe(2);

    // Latest badge on first upgrade
    expect(screen.getByText("Latest")).toBeDefined();

    // Ledger numbers
    expect(screen.getByText("#1,045,200")).toBeDefined();
    expect(screen.getByText("#980,100")).toBeDefined();

    // Initial deployment label
    expect(screen.getByText("Initial")).toBeDefined();

    // Source link
    const sourceLink = screen.getByRole("link", {
      name: /view verified source code for this upgrade at https:\/\/github.com\/sorolens\/contracts\/tree\/v2.0.0/i,
    });
    expect(sourceLink).toBeDefined();
    expect(sourceLink.getAttribute("href")).toBe(
      "https://github.com/sorolens/contracts/tree/v2.0.0"
    );
  });

  it("matches verified source ref from contract verification endpoint when not on upgrade item", async () => {
    const upgradesWithoutRef: ContractUpgrade[] = [
      {
        contract_id: contractId,
        from_hash: "1111",
        to_hash: "2222",
        ledger: 100,
        at: "2026-02-01T00:00:00Z",
      },
    ];

    const verification: ContractVerification = {
      contract_id: contractId,
      status: "verified",
      matched: true,
      compiled_wasm_hash: "2222",
      source: {
        kind: "git",
        ref: "https://github.com/sorolens/verified-source",
      },
      toolchain: {},
      diagnostics: [],
      submitted_at: "2026-02-01T00:00:00Z",
      updated_at: "2026-02-01T00:00:00Z",
    };

    vi.spyOn(api, "getContractUpgrades").mockResolvedValue({
      upgrades: upgradesWithoutRef,
    });
    vi.spyOn(api, "getContractVerification").mockResolvedValue(verification);

    render(<ContractUpgradesTimeline contractId={contractId} />);

    await waitFor(() => {
      expect(screen.getByTestId("upgrades-timeline")).toBeDefined();
    });

    const sourceLink = screen.getByRole("link", {
      name: /view verified source code for this upgrade at https:\/\/github.com\/sorolens\/verified-source/i,
    });
    expect(sourceLink).toBeDefined();
    expect(sourceLink.getAttribute("href")).toBe(
      "https://github.com/sorolens/verified-source"
    );
  });

  it("renders empty state when there are no upgrades", async () => {
    vi.spyOn(api, "getContractUpgrades").mockResolvedValue({
      upgrades: [],
    });
    vi.spyOn(api, "getContractVerification").mockRejectedValue(
      new Error("404")
    );

    render(<ContractUpgradesTimeline contractId={contractId} />);

    await waitFor(() => {
      expect(screen.getByTestId("upgrades-empty")).toBeDefined();
    });
    expect(
      screen.getByText(/No Wasm hash transitions have been recorded/i)
    ).toBeDefined();
  });

  it("renders error state and allows retry on API failure", async () => {
    const getSpy = vi
      .spyOn(api, "getContractUpgrades")
      .mockRejectedValueOnce(new Error("Network timeout"))
      .mockResolvedValueOnce({ upgrades: mockUpgrades });

    vi.spyOn(api, "getContractVerification").mockResolvedValue({
      contract_id: contractId,
      status: "unverified",
      matched: false,
      source: { kind: "git" },
      toolchain: {},
      diagnostics: [],
      submitted_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });

    render(<ContractUpgradesTimeline contractId={contractId} />);

    await waitFor(() => {
      expect(screen.getByTestId("upgrades-error")).toBeDefined();
    });
    expect(screen.getByText("Network timeout")).toBeDefined();

    const retryBtn = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId("upgrades-timeline")).toBeDefined();
    });
    expect(getSpy).toHaveBeenCalledTimes(2);
  });
});
