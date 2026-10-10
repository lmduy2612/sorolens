import { describe, expect, it, vi, beforeEach } from "vitest";
import { generateMetadata } from "./layout";
import * as api from "@/lib/api";

vi.mock("@/lib/api", () => ({
  getContract: vi.fn(),
}));

describe("Contract detail metadata & Open Graph (#620)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates rich metadata when contract is found", async () => {
    vi.mocked(api.getContract).mockResolvedValueOnce({
      id: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      network: "testnet",
      label: "Treasury Contract",
      status: "active",
      wasm_hash: "abcd",
      backfill_complete_at: null,
      sync: null,
      storage_entry_count: 42,
      expiring_entry_count: 3,
      tags: ["defi"],
      added_at: "2026-01-01T00:00:00Z",
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({
        id: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      }),
    });

    expect(metadata.title).toBe("Treasury Contract (CAAAAA…AAAA)");
    expect(metadata.description).toContain(
      "Treasury Contract (CAAAAA…AAAA) on testnet"
    );
    expect(metadata.description).toContain("42 storage entries");
    expect(metadata.openGraph?.title).toBe(
      "Treasury Contract (CAAAAA…AAAA) — Sorolens"
    );
    expect(metadata.openGraph?.url).toBe(
      "/contracts/CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    );
    expect(metadata.alternates?.canonical).toBe(
      "/contracts/CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    );
  });

  it("falls back gracefully when contract fetch fails", async () => {
    vi.mocked(api.getContract).mockRejectedValueOnce(
      new Error("Network error")
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({
        id: "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      }),
    });

    expect(metadata.title).toBe("Contract CBBBBB…BBBB");
    expect(metadata.description).toContain(
      "Events, invocations, storage health, and anomaly detection"
    );
    expect(metadata.openGraph?.url).toBe(
      "/contracts/CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
    );
    expect(metadata.alternates?.canonical).toBe(
      "/contracts/CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
    );
  });

  it("exports correct opengraph image dimensions and content type", async () => {
    const {
      size,
      contentType,
      default: renderImage,
    } = await import("./opengraph-image");

    expect(size).toEqual({ width: 1200, height: 630 });
    expect(contentType).toBe("image/png");

    vi.mocked(api.getContract).mockResolvedValueOnce({
      id: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      network: "testnet",
      label: "Vault Contract",
      status: "active",
      wasm_hash: "abcd",
      backfill_complete_at: null,
      sync: null,
      storage_entry_count: 10,
      expiring_entry_count: 0,
      tags: [],
      added_at: "2026-01-01T00:00:00Z",
    });

    const response = await renderImage({
      params: Promise.resolve({
        id: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      }),
    });

    expect(response).toBeDefined();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
  });
});
