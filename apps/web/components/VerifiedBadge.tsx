"use client";

import { useEffect, useState } from "react";
import { getContractVerification } from "@/lib/api";
import type { ContractVerification } from "@/lib/types";

export interface VerifiedBadgeProps {
  contractId?: string;
  sourceRef?: string;
  compiledWasmHash?: string;
  className?: string;
}

/**
 * Shows a `Verified` pill when the backend has a matching source verification
 * for the contract (issue #263 / #603). Links directly to the verified source
 * code repository/commit when available.
 */
export function VerifiedBadge({
  contractId,
  sourceRef,
  compiledWasmHash,
  className = "",
}: VerifiedBadgeProps) {
  const [verification, setVerification] = useState<ContractVerification | null>(
    null
  );

  useEffect(() => {
    if (!contractId || sourceRef) return;
    let cancelled = false;
    getContractVerification(contractId)
      .then((data) => {
        if (!cancelled) setVerification(data);
      })
      .catch(() => {
        // A contract that has never been submitted 404s; treat that as
        // "no badge" rather than an error.
      });
    return () => {
      cancelled = true;
    };
  }, [contractId, sourceRef]);

  // If sourceRef was provided explicitly, it is verified
  const isVerified = Boolean(sourceRef) || verification?.status === "verified";
  if (!isVerified) {
    return null;
  }

  const effectiveRef = sourceRef || verification?.source?.ref;
  const hash = compiledWasmHash || verification?.compiled_wasm_hash || "";
  const titleText = `Source verified: the rebuilt Wasm hash matches the on-chain hash${
    hash ? ` (${hash})` : ""
  }${effectiveRef ? ` - ${effectiveRef}` : ""}`;

  if (effectiveRef) {
    return (
      <a
        href={effectiveRef}
        target="_blank"
        rel="noopener noreferrer"
        title={titleText}
        aria-label={`Source verified: view source at ${effectiveRef} (opens in new tab)`}
        className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-900/40 px-2.5 py-0.5 text-xs font-medium text-emerald-400 hover:bg-emerald-900/60 hover:text-emerald-300 transition-colors ${className}`}
      >
        <span
          className="h-1.5 w-1.5 rounded-full bg-emerald-400"
          aria-hidden="true"
        />
        Verified
        <svg
          className="h-3 w-3 opacity-70"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </a>
    );
  }

  return (
    <span
      title={titleText}
      aria-label={titleText}
      className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-900/40 px-2.5 py-0.5 text-xs font-medium text-emerald-400 ${className}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-emerald-400"
        aria-hidden="true"
      />
      Verified
    </span>
  );
}

export default VerifiedBadge;
