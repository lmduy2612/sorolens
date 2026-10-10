"use client";

import * as React from "react";
import { Command } from "cmdk";
import { useDebounce } from "use-debounce";
import { useRouter } from "next/navigation";
import { useTheme } from "./ThemeProvider";
import { searchContracts } from "@/lib/api";
import { useNetwork, networkFilter } from "@/lib/network";
import type { Contract } from "@/lib/types";

export function CmdkSearch() {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const [debouncedValue] = useDebounce(inputValue, 300);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<Contract[]>([]);
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { network } = useNetwork();

  // Toggle the menu when ⌘K or Ctrl+K is pressed
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  React.useEffect(() => {
    if (!open) {
      setInputValue("");
      setResults([]);
      setError(null);
    }
  }, [open]);

  React.useEffect(() => {
    const query = debouncedValue.trim();
    if (!query) {
      setResults([]);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    searchContracts(query, { network: networkFilter(network), limit: 10 })
      .then((data) => {
        if (active) {
          setResults(data.items || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Failed to search contracts"
          );
          setResults([]);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [debouncedValue, network]);

  const handleFullSearch = () => {
    if (inputValue.trim()) {
      router.push(`/search?q=${encodeURIComponent(inputValue.trim())}`);
      setOpen(false);
    }
  };

  return (
    <>
      {/* Mobile trigger icon button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search contracts (Cmd+K)"
        className="flex md:hidden items-center justify-center p-2 text-[var(--color-text-secondary)] bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-md hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 15 15"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.56251 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.56251 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C12.6583 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159Z"
            fill="currentColor"
            fillRule="evenodd"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Desktop trigger search bar */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--color-text-secondary)] bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-md hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 15 15"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="opacity-70"
          aria-hidden="true"
        >
          <path
            d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.56251 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.56251 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C12.6583 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159Z"
            fill="currentColor"
            fillRule="evenodd"
            clipRule="evenodd"
          />
        </svg>
        <span>Search contracts...</span>
        <kbd className="ml-2 px-1.5 py-0.5 text-xs rounded bg-[var(--color-bg-page)] border border-[var(--color-border)] opacity-70">
          ⌘K
        </kbd>
      </button>

      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Search Contracts"
        className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm p-4"
      >
        <div className="w-full max-w-xl bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
          <div className="relative border-b border-[var(--color-border)] flex items-center px-4">
            <svg
              width="18"
              height="18"
              viewBox="0 0 15 15"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-[var(--color-text-secondary)] mr-2 shrink-0"
              aria-hidden="true"
            >
              <path
                d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.56251 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.56251 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C12.6583 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159Z"
                fill="currentColor"
                fillRule="evenodd"
                clipRule="evenodd"
              />
            </svg>
            <Command.Input
              value={inputValue}
              onValueChange={setInputValue}
              placeholder="Search contracts by ID or label..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && inputValue.trim()) {
                  handleFullSearch();
                }
              }}
              className="w-full py-4 bg-transparent outline-none text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] text-sm"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 mx-2 my-2 text-center text-xs text-red-400 bg-red-500/10 rounded-md border border-red-500/20"
            >
              Error: {error}
            </div>
          )}

          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            <Command.Empty className="p-6 text-center text-sm text-[var(--color-text-secondary)]">
              {loading ? "Searching..." : "No results found."}
            </Command.Empty>

            {inputValue.trim() && (
              <Command.Group
                heading="Navigation"
                className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2 px-2"
              >
                <Command.Item
                  onSelect={handleFullSearch}
                  className="flex items-center justify-between px-3 py-2.5 text-sm text-[var(--color-text-primary)] rounded-md cursor-pointer data-[selected=true]:bg-[var(--color-bg-page)]"
                >
                  <span className="flex items-center gap-2">
                    <span>
                      View all results for &ldquo;{inputValue.trim()}&rdquo;
                    </span>
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    ↵ Enter
                  </span>
                </Command.Item>
              </Command.Group>
            )}

            <Command.Group
              heading="Commands"
              className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2 px-2 mt-2 first:mt-0"
            >
              <Command.Item
                onSelect={() => {
                  router.push("/contracts/new");
                  setOpen(false);
                }}
                className="flex items-center gap-3 px-3 py-2.5 text-sm text-[var(--color-text-primary)] rounded-md cursor-pointer data-[selected=true]:bg-[var(--color-bg-page)]"
              >
                Track contract
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  setTheme(theme === "dark" ? "light" : "dark");
                  setOpen(false);
                }}
                className="flex items-center gap-3 px-3 py-2.5 text-sm text-[var(--color-text-primary)] rounded-md cursor-pointer data-[selected=true]:bg-[var(--color-bg-page)]"
              >
                Toggle theme
              </Command.Item>
            </Command.Group>

            {results.length > 0 && (
              <Command.Group
                heading="Contracts"
                className="text-xs font-semibold text-[var(--color-text-secondary)] px-2 mt-4"
              >
                {results.map((contract) => (
                  <Command.Item
                    key={contract.id}
                    value={`${contract.label ?? ""} ${contract.id}`}
                    onSelect={() => {
                      router.push(`/contracts/${contract.id}`);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm text-[var(--color-text-primary)] rounded-md cursor-pointer data-[selected=true]:bg-[var(--color-bg-page)]"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {contract.label || "Unnamed Contract"}
                      </div>
                      <div
                        className="text-xs text-[var(--color-text-secondary)] font-mono truncate max-w-sm"
                        title={contract.id}
                      >
                        {contract.id}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-bg-page)] border border-[var(--color-border)] capitalize text-[var(--color-text-secondary)]">
                        {contract.network}
                      </span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </div>
      </Command.Dialog>
    </>
  );
}
