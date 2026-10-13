"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { listWatchlist } from "@/lib/api";
import type { WatchlistItem } from "@/lib/types";
import { StarButton } from "@/components/StarButton";
import { useUserId } from "@/lib/user";

export default function WatchlistPage() {
  const userId = useUserId(true);
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listWatchlist(userId);
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load watchlist");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
          Watchlist
        </h1>
      </div>

      {loading && (
        <div className="space-y-4" data-testid="watchlist-skeleton">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-lg bg-[var(--color-bg-card)] animate-pulse"
            />
          ))}
        </div>
      )}

      {!loading && error && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-950/20 p-6 text-center text-red-400"
        >
          <p className="text-sm font-medium">{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 inline-flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-border)]"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="rounded-lg bg-[var(--color-bg-card)] px-8 py-16 text-center border border-[var(--color-border)]">
          <p className="text-lg font-medium text-[var(--color-text-primary)]">
            No bookmarks yet
          </p>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Star a contract on the{" "}
            <Link
              href="/contracts"
              className="text-[var(--color-accent)] underline underline-offset-2 hover:opacity-80"
            >
              Contracts page
            </Link>{" "}
            to add it to your watchlist.
          </p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table
            className="min-w-full text-left text-sm"
            data-testid="watchlist-table"
          >
            <thead className="bg-[var(--color-bg-card)] text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-4 py-2 font-medium">Contract</th>
                <th className="px-4 py-2 font-medium">Added</th>
                <th className="px-4 py-2 font-medium w-16 text-center"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.contract_id}
                  className="border-t border-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-card)]"
                >
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-primary)]">
                    <Link
                      href={`/contracts/${item.contract_id}`}
                      className="hover:text-[var(--color-accent)]"
                    >
                      {item.contract_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[var(--color-text-secondary)]">
                    {new Date(item.added_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StarButton
                      contractId={item.contract_id}
                      userId={userId}
                      initialInWatchlist
                      showToast
                      onToggle={(inList) => {
                        if (!inList) {
                          setItems((prev) =>
                            prev.filter(
                              (i) => i.contract_id !== item.contract_id
                            )
                          );
                        }
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
