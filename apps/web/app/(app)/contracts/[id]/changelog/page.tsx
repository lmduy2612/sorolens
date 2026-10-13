"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MonoId, ContractChangelog, CopyButton } from "@sorolens/ui";
import {
  getContract,
  getContractChangelog,
  contractChangelogFeedUrl,
  contractChangelogBadgeUrl,
  ApiError,
  API_URL,
} from "@/lib/api";
import type { ContractDetail, ContractVersionEntry } from "@/lib/types";

interface Props {
  id?: string;
  params?: Promise<{ id: string }>;
}

export default function ContractChangelogPage({ id, params }: Props) {
  const contractId = id ?? (params ? use(params).id : "");
  return <ContractChangelogContent id={contractId} />;
}

export function ContractChangelogContent({ id }: { id: string }) {
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [entries, setEntries] = useState<ContractVersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [contractData, changelogData] = await Promise.all([
        getContract(id),
        getContractChangelog(id),
      ]);
      setContract(contractData);
      setEntries(changelogData);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        notFound();
      }
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load contract changelog."
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const feedUrl = contractChangelogFeedUrl(id);
  const badgeUrl = contractChangelogBadgeUrl(id);
  const badgeMarkdown = `![Wasm Hash](${badgeUrl})`;

  return (
    <div className="space-y-8">
      {/* Header and Back Link */}
      <div>
        <Link
          href={`/contracts/${id}`}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-3"
        >
          <span aria-hidden="true">←</span>
          <span>Back to contract overview</span>
        </Link>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
              Wasm Changelog
            </h1>
            <span className="font-mono text-sm text-[var(--color-text-secondary)]">
              <MonoId value={id} headChars={6} tailChars={6} />
            </span>
          </div>
          {contract?.label && (
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">
              {contract.label}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Chronological record of all Wasm bytecode hashes deployed to this
          contract, with Atom RSS feed and embeddable status badge.
        </p>
      </div>

      {/* Syndication & Badge Integrations */}
      <div
        data-testid="changelog-integrations"
        className="grid gap-4 sm:grid-cols-2"
      >
        {/* Atom 1.0 Feed */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base" aria-hidden="true">
                ⚛
              </span>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Atom / RSS Feed
              </h2>
            </div>
            <CopyButton text={feedUrl} label="Copy Feed URL" />
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Subscribe to Wasm code upgrades via your favorite RSS reader.
          </p>
          <div className="pt-1">
            <a
              href={feedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--color-accent)] hover:underline break-all"
            >
              {feedUrl} ↗
            </a>
          </div>
        </div>

        {/* SVG Badge */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base" aria-hidden="true">
                🏷
              </span>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Embeddable SVG Badge
              </h2>
            </div>
            <CopyButton text={badgeMarkdown} label="Copy Markdown" />
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Show the current on-chain Wasm hash in your GitHub README.
          </p>
          <div className="flex items-center gap-3 pt-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={badgeUrl} alt="Wasm badge" className="h-5" />
            <code className="text-[11px] font-mono text-[var(--color-text-secondary)] truncate max-w-xs">
              {badgeMarkdown}
            </code>
          </div>
        </div>
      </div>

      {/* Main Changelog Timeline */}
      {loading ? (
        <div
          data-testid="changelog-loading"
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 animate-pulse space-y-4"
        >
          <div className="h-5 w-48 rounded bg-[var(--color-border)]" />
          <div className="h-16 rounded bg-[var(--color-bg-page)]" />
          <div className="h-16 rounded bg-[var(--color-bg-page)]" />
        </div>
      ) : error ? (
        <div
          role="alert"
          data-testid="changelog-error"
          className="rounded-lg border border-red-500/30 bg-red-950/20 p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-red-400">{error}</span>
            <button
              type="button"
              onClick={loadData}
              className="rounded-md border border-red-500/40 bg-red-950/40 px-3 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-900/40"
            >
              Retry
            </button>
          </div>
        </div>
      ) : (
        <div data-testid="changelog-container">
          <ContractChangelog
            contractId={id}
            entries={entries}
            apiBase={API_URL}
          />
        </div>
      )}
    </div>
  );
}
