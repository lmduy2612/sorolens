"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { searchContracts } from "@/lib/api";
import { useNetwork, networkFilter } from "@/lib/network";
import type { Contract } from "@/lib/types";
import { Spinner } from "@/components/Spinner";

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryParam = searchParams.get("q") ?? "";
  const { network } = useNetwork();

  const [inputVal, setInputVal] = useState(queryParam);
  const [results, setResults] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchedQuery, setSearchedQuery] = useState(queryParam);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setInputVal(queryParam);
    setSearchedQuery(queryParam);

    const q = queryParam.trim();
    if (!q) {
      setResults([]);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    searchContracts(q, { network: networkFilter(network), limit: 25 })
      .then((res) => {
        if (active) {
          setResults(res.items || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Failed to load search results"
          );
          setResults([]);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [queryParam, network]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputVal.trim();
    if (trimmed) {
      startTransition(() => {
        router.push(`/search?q=${encodeURIComponent(trimmed)}`);
      });
    }
  };

  const isTxHash = /^[0-9a-fA-F]{64}$/.test(searchedQuery.trim());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
          Search Results
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Search contracts by ID, label, or view matching transactions across
          networks.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 max-w-2xl">
        <input
          type="search"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Search by contract ID or label..."
          className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] outline-none focus:border-[var(--color-accent)]"
        />
        <button
          type="submit"
          className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Search
        </button>
      </form>

      {isTxHash && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase font-semibold text-[var(--color-accent)] tracking-wider">
              Transaction Hash Detected
            </div>
            <div className="font-mono text-xs text-[var(--color-text-secondary)] mt-1 truncate max-w-lg">
              {searchedQuery.trim()}
            </div>
          </div>
          <Link
            href={`/events?tx_hash=${encodeURIComponent(searchedQuery.trim())}`}
            className="text-xs font-medium text-[var(--color-accent)] hover:underline shrink-0 ml-4"
          >
            View Events for Transaction →
          </Link>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center p-12 text-[var(--color-text-secondary)]">
          <Spinner className="h-6 w-6 mr-3 text-[var(--color-accent)]" />
          <span>Searching indexed contracts...</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400"
        >
          {error}
        </div>
      )}

      {!loading && !error && searchedQuery.trim() && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
            <span>
              Found {results.length} result{results.length === 1 ? "" : "s"} for
              &ldquo;{searchedQuery.trim()}&rdquo;
            </span>
            {network !== "all" && (
              <span className="capitalize">Network filter: {network}</span>
            )}
          </div>

          {results.length === 0 ? (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 text-center">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                No matching contracts found
              </h3>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)] max-w-md mx-auto">
                No contract matches &ldquo;{searchedQuery.trim()}&rdquo; on the
                selected network. You can track this contract or broaden your
                query.
              </p>
              <div className="mt-4">
                <Link
                  href="/contracts/new"
                  className="inline-flex items-center rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  Track new contract
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden">
              {results.map((contract) => (
                <div
                  key={contract.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--color-bg-page)] transition-colors"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/contracts/${contract.id}`}
                      className="font-semibold text-base text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors"
                    >
                      {contract.label || "Unnamed Contract"}
                    </Link>
                    <div className="font-mono text-xs text-[var(--color-text-secondary)] mt-1 truncate">
                      {contract.id}
                    </div>
                    {contract.tags && contract.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {contract.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-[var(--color-bg-page)] border border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-bg-page)] border border-[var(--color-border)] capitalize text-[var(--color-text-secondary)] font-medium">
                      {contract.network}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full capitalize font-medium ${
                        contract.status === "active"
                          ? "bg-green-900/30 text-green-400 border border-green-800/40"
                          : "bg-gray-800 text-gray-400 border border-gray-700"
                      }`}
                    >
                      {contract.status}
                    </span>
                    <Link
                      href={`/contracts/${contract.id}`}
                      className="rounded-md border border-[var(--color-border)] px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors"
                    >
                      View →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!searchedQuery.trim() && !loading && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 text-center text-[var(--color-text-secondary)] text-sm">
          Enter a contract ID, label, or 64-character transaction hash above to
          begin searching.
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-12 text-[var(--color-text-secondary)]">
          <Spinner className="h-6 w-6 mr-3 text-[var(--color-accent)]" />
          <span>Loading search...</span>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
