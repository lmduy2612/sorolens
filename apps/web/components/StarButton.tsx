"use client";

import { useEffect, useState, useTransition } from "react";
import { Toast, type ToastVariant } from "@sorolens/ui";
import {
  addToWatchlist,
  removeFromWatchlist,
  watchlistStatus,
} from "@/lib/api";
import { ensureUserId, useUserId } from "@/lib/user";

export interface StarButtonProps {
  contractId: string;
  userId?: string;
  initialInWatchlist?: boolean;
  onToggle?: (inWatchlist: boolean) => void;
  showToast?: boolean;
  className?: string;
}

export function StarButton({
  contractId,
  userId,
  initialInWatchlist,
  onToggle,
  showToast = false,
  className = "",
}: StarButtonProps) {
  const hookUserId = useUserId();
  const activeUserId = userId || hookUserId;

  const [inWatchlist, setInWatchlist] = useState<boolean>(
    initialInWatchlist ?? false
  );
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{
    message: string;
    variant: ToastVariant;
  } | null>(null);

  // Sync with prop changes when provided
  useEffect(() => {
    if (initialInWatchlist !== undefined) {
      setInWatchlist(initialInWatchlist);
    }
  }, [initialInWatchlist]);

  // Fetch initial state if not provided by parent
  useEffect(() => {
    if (initialInWatchlist !== undefined || !activeUserId) return;
    let cancelled = false;
    watchlistStatus(contractId, activeUserId)
      .then((res) => {
        if (!cancelled && typeof res?.in_watchlist === "boolean") {
          setInWatchlist(res.in_watchlist);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [contractId, activeUserId, initialInWatchlist]);

  const toggle = () => {
    startTransition(async () => {
      const uid = activeUserId || ensureUserId();
      const nextState = !inWatchlist;
      try {
        if (inWatchlist) {
          await removeFromWatchlist(contractId, uid);
          setInWatchlist(false);
          onToggle?.(false);
          if (showToast) {
            setToast({
              message: "Removed from watchlist",
              variant: "success",
            });
          }
        } else {
          await addToWatchlist(contractId, uid);
          setInWatchlist(true);
          onToggle?.(true);
          if (showToast) {
            setToast({
              message: "Added to watchlist",
              variant: "success",
            });
          }
        }
      } catch (err) {
        // Rollback / keep current state
        if (showToast) {
          setToast({
            message: inWatchlist
              ? "Failed to remove from watchlist"
              : "Failed to add to watchlist",
            variant: "error",
          });
        }
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        data-testid={`star-${contractId}`}
        className={`inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-sm transition-colors hover:bg-[var(--color-bg-card)] disabled:opacity-50 ${className}`}
        aria-label={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
        title={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
      >
        <span
          aria-hidden="true"
          className={
            inWatchlist
              ? "text-yellow-400"
              : "text-[var(--color-text-secondary)]"
          }
        >
          ★
        </span>
      </button>

      {showToast && toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  );
}
