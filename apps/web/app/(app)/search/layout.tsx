import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search",
  description:
    "Search contracts, labels, and transactions across Soroban networks on Sorolens.",
  openGraph: {
    title: "Search — Sorolens",
    description:
      "Search contracts, labels, and transactions across Soroban networks on Sorolens.",
    url: "/search",
  },
  alternates: {
    canonical: "/search",
  },
};

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
