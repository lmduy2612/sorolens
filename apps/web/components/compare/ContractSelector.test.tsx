/**
 * Tests for apps/web/components/compare/ContractSelector.tsx
 *
 * We use vitest + @testing-library/react + jsdom.
 */

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ContractSummary } from "@/lib/types";
import { ContractSelector } from "./ContractSelector";

const LONG_CONTRACT_ID =
  "CAVRQGH5C3VRQGH5C3VRQGH5C3VRQGH5C3VRQGH5C3VRQGH5C3VRQGH5C33";

function contract(overrides: Partial<ContractSummary> = {}): ContractSummary {
  return {
    id: LONG_CONTRACT_ID,
    network: "testnet",
    label: null,
    status: "active",
    wasm_hash: null,
    added_at: "2026-01-01T00:00:00Z",
    last_activity_at: null,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("ContractSelector", () => {
  it("shows the full contract id in a tooltip on a truncated slot", () => {
    render(
      <ContractSelector
        selected={[LONG_CONTRACT_ID]}
        onSelect={() => {}}
        contracts={[contract()]}
      />
    );

    const slot = screen.getByTestId("compare-slot-filled");
    const label = screen.getByText("CAVRQG…5C33");
    expect(slot).toContainElement(label);
    expect(label).toHaveAttribute("title", LONG_CONTRACT_ID);
  });

  it("keeps the full contract id in the tooltip when the slot shows a label", () => {
    render(
      <ContractSelector
        selected={[LONG_CONTRACT_ID]}
        onSelect={() => {}}
        contracts={[contract({ label: "My token" })]}
      />
    );

    const slot = screen.getByTestId("compare-slot-filled");
    const label = slot.querySelector("span");
    expect(label).toHaveTextContent("My token");
    expect(label).toHaveAttribute("title", LONG_CONTRACT_ID);
  });

  it("does not add a tooltip to empty slots", () => {
    render(
      <ContractSelector selected={[]} onSelect={() => {}} contracts={[]} />
    );

    const [emptySlot] = screen.getAllByTestId("compare-slot-empty");
    expect(screen.getByText("Slot 1")).not.toHaveAttribute("title");
    expect(emptySlot).toBeInTheDocument();
  });

  it("allows manually adding a contract by valid ID", async () => {
    const onSelect = vi.fn();
    const validId = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    render(
      <ContractSelector selected={[]} onSelect={onSelect} contracts={[]} />
    );

    const input = screen.getByTestId("manual-contract-input");
    const addBtn = screen.getByTestId("add-contract-btn");

    fireEvent.change(input, { target: { value: validId } });
    expect(addBtn).not.toBeDisabled();
    fireEvent.click(addBtn);

    expect(onSelect).toHaveBeenCalledWith([validId]);
  });

  it("shows validation error when entering an invalid contract ID", async () => {
    const onSelect = vi.fn();
    render(
      <ContractSelector selected={[]} onSelect={onSelect} contracts={[]} />
    );

    const input = screen.getByTestId("manual-contract-input");
    const addBtn = screen.getByTestId("add-contract-btn");

    fireEvent.change(input, { target: { value: "invalid-id" } });
    fireEvent.click(addBtn);

    expect(onSelect).not.toHaveBeenCalled();
    const errorMsg = await screen.findByTestId("manual-input-error");
    expect(errorMsg).toBeInTheDocument();
    expect(errorMsg).toHaveTextContent(/Contract ID must start with 'C'/i);
  });

  it("marks an invalid contract slot with an invalid badge", () => {
    render(
      <ContractSelector
        selected={["INVALID_ID"]}
        onSelect={() => {}}
        contracts={[]}
      />
    );

    const badge = screen.getByTestId("invalid-slot-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("Invalid");
  });
});
