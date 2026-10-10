import { ImageResponse } from "next/og";
import { getContract } from "@/lib/api";

export const runtime = "edge";
export const alt = "Soroban Contract Overview";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let label: string | null = null;
  let network = "Stellar";
  let status = "active";
  let storageCount = 0;
  let expiringCount = 0;

  try {
    const contract = await getContract(id);
    if (contract) {
      label = contract.label;
      network = contract.network || "Stellar";
      status = contract.status || "active";
      storageCount = contract.storage_entry_count ?? 0;
      expiringCount = contract.expiring_entry_count ?? 0;
    }
  } catch {
    // Graceful fallback when backend is offline or contract not found
  }

  const displayTitle = label || "Soroban Contract";
  const shortId = id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "60px",
        backgroundColor: "#030712",
        color: "#f9fafb",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Top bar: Brand & Badges */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              backgroundColor: "#3b82f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "26px",
              fontWeight: 800,
              color: "#ffffff",
            }}
          >
            S
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span
              style={{
                fontSize: "28px",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "#ffffff",
              }}
            >
              Sorolens
            </span>
            <span style={{ fontSize: "14px", color: "#9ca3af" }}>
              Soroban Contract Observability
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <span
            style={{
              padding: "8px 18px",
              borderRadius: "9999px",
              fontSize: "18px",
              fontWeight: 600,
              backgroundColor: "#1e3a8a",
              color: "#93c5fd",
              textTransform: "uppercase",
            }}
          >
            {network}
          </span>
          <span
            style={{
              padding: "8px 18px",
              borderRadius: "9999px",
              fontSize: "18px",
              fontWeight: 600,
              backgroundColor: status === "active" ? "#064e3b" : "#374151",
              color: status === "active" ? "#6ee7b7" : "#d1d5db",
              textTransform: "capitalize",
            }}
          >
            {status}
          </span>
        </div>
      </div>

      {/* Center: Contract info */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div
          style={{
            fontSize: "52px",
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-0.02em",
            maxWidth: "1000px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {displayTitle}
        </div>
        <div
          style={{
            fontSize: "24px",
            fontFamily: "monospace",
            color: "#9ca3af",
            backgroundColor: "#111827",
            padding: "12px 20px",
            borderRadius: "12px",
            border: "1px solid #1f2937",
            alignSelf: "flex-start",
          }}
        >
          {shortId}
        </div>
      </div>

      {/* Footer: Key Metrics */}
      <div
        style={{
          display: "flex",
          gap: "48px",
          paddingTop: "24px",
          borderTop: "1px solid #1f2937",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontSize: "16px",
              color: "#9ca3af",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Storage Entries
          </span>
          <span
            style={{
              fontSize: "36px",
              fontWeight: 700,
              color: "#ffffff",
            }}
          >
            {storageCount}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontSize: "16px",
              color: "#9ca3af",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Expiring Entries
          </span>
          <span
            style={{
              fontSize: "36px",
              fontWeight: 700,
              color: expiringCount > 0 ? "#f87171" : "#ffffff",
            }}
          >
            {expiringCount}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontSize: "16px",
              color: "#9ca3af",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Contract ID
          </span>
          <span
            style={{
              fontSize: "36px",
              fontWeight: 700,
              color: "#60a5fa",
              fontFamily: "monospace",
            }}
          >
            {id.slice(0, 10)}…
          </span>
        </div>
      </div>
    </div>,
    {
      ...size,
    }
  );
}
