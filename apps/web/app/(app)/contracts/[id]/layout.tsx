import type { Metadata } from "next";
import { getContract } from "@/lib/api";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const shortId = id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;

  let label: string | null = null;
  let network = "Stellar";
  let storageCount = 0;

  try {
    const contract = await getContract(id);
    if (contract) {
      label = contract.label;
      network = contract.network || "Stellar";
      storageCount = contract.storage_entry_count ?? 0;
    }
  } catch {
    // Graceful fallback if API is unreachable or contract not found
  }

  const title = label ? `${label} (${shortId})` : `Contract ${shortId}`;
  const description = label
    ? `${label} (${shortId}) on ${network} with ${storageCount} storage entries. Observability, events, and anomaly detection on Sorolens.`
    : `Events, invocations, storage health, and anomaly detection for Soroban contract ${id}.`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} — Sorolens`,
      description,
      url: `/contracts/${id}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — Sorolens`,
      description,
    },
    alternates: {
      canonical: `/contracts/${id}`,
    },
  };
}

export default function ContractDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
