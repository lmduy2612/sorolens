/**
 * Tests for VerifiedBadge component (issue #603)
 */

import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VerifiedBadge } from "./VerifiedBadge";
import * as api from "@/lib/api";

describe("VerifiedBadge", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders nothing when contract has no verification or status is not verified", async () => {
    vi.spyOn(api, "getContractVerification").mockResolvedValue({
      contract_id: "CAAA",
      status: "unverified",
      matched: false,
      source: { kind: "git" },
      toolchain: {},
      diagnostics: [],
      submitted_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });

    const { container } = render(<VerifiedBadge contractId="CAAA" />);
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("renders nothing when API 404s", async () => {
    vi.spyOn(api, "getContractVerification").mockRejectedValue(
      new Error("404 Not Found")
    );

    const { container } = render(<VerifiedBadge contractId="CAAA" />);
    // Wait small tick
    await new Promise((r) => setTimeout(r, 10));
    expect(container.firstChild).toBeNull();
  });

  it("renders accessible link to source repository when verified and source ref is present", async () => {
    vi.spyOn(api, "getContractVerification").mockResolvedValue({
      contract_id: "CAAA",
      status: "verified",
      matched: true,
      compiled_wasm_hash: "abcdef123456",
      source: {
        kind: "git",
        ref: "https://github.com/sorolens/contracts/tree/v1.0.0",
      },
      toolchain: {},
      diagnostics: [],
      submitted_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });

    render(<VerifiedBadge contractId="CAAA" />);

    const link = await screen.findByRole("link", {
      name: /view source at https:\/\/github.com\/sorolens\/contracts\/tree\/v1.0.0/i,
    });
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe(
      "https://github.com/sorolens/contracts/tree/v1.0.0"
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("renders link immediately when sourceRef prop is explicitly passed without API call", () => {
    const apiSpy = vi.spyOn(api, "getContractVerification");

    render(
      <VerifiedBadge
        sourceRef="https://github.com/stellar/soroban-example"
        compiledWasmHash="11223344"
      />
    );

    const link = screen.getByRole("link", {
      name: /view source at https:\/\/github.com\/stellar\/soroban-example/i,
    });
    expect(link).toBeDefined();
    expect(link.getAttribute("href")).toBe(
      "https://github.com/stellar/soroban-example"
    );
    expect(apiSpy).not.toHaveBeenCalled();
  });

  it("renders non-link badge when verified but no source ref URL exists", async () => {
    vi.spyOn(api, "getContractVerification").mockResolvedValue({
      contract_id: "CAAA",
      status: "verified",
      matched: true,
      compiled_wasm_hash: "abcdef123456",
      source: { kind: "git" },
      toolchain: {},
      diagnostics: [],
      submitted_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });

    render(<VerifiedBadge contractId="CAAA" />);

    const badge = await screen.findByText("Verified");
    expect(badge).toBeDefined();
    expect(badge.tagName.toLowerCase()).toBe("span");
  });
});
