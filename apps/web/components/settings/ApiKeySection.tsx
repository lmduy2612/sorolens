"use client";

import { useEffect, useState } from "react";
import { SettingsCard, type SaveState } from "./SettingsCard";
import { maskApiKey } from "@/lib/settings";
import { ensureUserId } from "@/lib/user";

/**
 * API-key & Identity card backed by the real API.
 * Creates keys via POST /api/v1/api-keys and revokes them via DELETE /api/v1/api-keys/{id}.
 * Surfaces the browser User ID (X-User-ID) with a copy button.
 */
export function ApiKeySection({
  apiKey,
  apiKeyId,
  apiKeyPrefix,
  apiKeyCreatedAt,
  dirty,
  status,
  isGenerating,
  isRevoking,
  error,
  onGenerate,
  onRevoke,
  onSave,
}: {
  apiKey: string | null;
  apiKeyId?: string | null;
  apiKeyPrefix?: string | null;
  apiKeyCreatedAt: string | null;
  dirty?: boolean;
  status: SaveState;
  isGenerating?: boolean;
  isRevoking?: boolean;
  error?: string | null;
  onGenerate: () => void | Promise<void>;
  onRevoke: () => void | Promise<void>;
  onSave?: () => boolean;
}) {
  const handleSave = onSave || (() => true);
  const [userId, setUserIdState] = useState("");
  const [copiedUserId, setCopiedUserId] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);

  useEffect(() => {
    setUserIdState(ensureUserId());
  }, []);

  const handleCopyUserId = async () => {
    if (!userId) return;
    try {
      await navigator.clipboard.writeText(userId);
      setCopiedUserId(true);
      setTimeout(() => setCopiedUserId(false), 2000);
    } catch {
      // Fallback if clipboard API is blocked in test or environment
    }
  };

  const handleCopyApiKey = async () => {
    if (!apiKey) return;
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopiedApiKey(true);
      setTimeout(() => setCopiedApiKey(false), 2000);
    } catch {
      // Fallback
    }
  };

  const hasKey = Boolean(apiKey || apiKeyId || apiKeyPrefix);

  return (
    <SettingsCard
      testId="settings-api-key"
      title="API key & Identity"
      description="Authenticate requests to the Sorolens REST API and manage your contributor identity."
      status={status}
      onSave={handleSave}
    >
      {/* User Identity Section */}
      <div className="space-y-2 border-b border-[var(--color-border)] pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              Browser User ID
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Forwarded as{" "}
              <code className="font-mono text-[var(--color-text-primary)]">
                X-User-ID
              </code>{" "}
              on API calls.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code
              data-testid="settings-user-id-value"
              className="rounded border border-[var(--color-border)] bg-[var(--color-bg-page)] px-2.5 py-1 font-mono text-xs text-[var(--color-text-primary)]"
            >
              {userId || "—"}
            </code>
            <button
              type="button"
              data-testid="copy-user-id"
              onClick={handleCopyUserId}
              className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent)]"
            >
              {copiedUserId ? "Copied!" : "Copy User ID"}
            </button>
          </div>
        </div>
      </div>

      {/* API Key Section */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {hasKey ? "Active API Key" : "No API key"}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {apiKeyCreatedAt
                ? `Created ${new Date(apiKeyCreatedAt).toLocaleDateString()}${
                    apiKeyId ? ` (ID: ${apiKeyId.slice(0, 8)}...)` : ""
                  }`
                : "Create a real key via the API to authenticate scripts and webhooks."}
            </p>
          </div>

          <code
            data-testid="settings-api-key-value"
            className="rounded border border-[var(--color-border)] bg-[var(--color-bg-page)] px-2.5 py-1 font-mono text-xs text-[var(--color-text-primary)]"
          >
            {apiKey
              ? apiKey
              : apiKeyPrefix
                ? maskApiKey(null, apiKeyPrefix)
                : "—"}
          </code>
        </div>

        {apiKey && (
          <div
            data-testid="api-key-created-alert"
            className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-[var(--color-text-primary)]"
          >
            <p className="font-semibold text-amber-400">
              New key created! Copy your secret token now:
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <code className="break-all font-mono text-xs">{apiKey}</code>
              <button
                type="button"
                data-testid="copy-api-key"
                onClick={handleCopyApiKey}
                className="shrink-0 rounded bg-amber-500/20 px-2 py-1 font-medium text-amber-300 hover:bg-amber-500/30"
              >
                {copiedApiKey ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="mt-1 text-amber-400/80">
              For security, this plaintext key is only returned once and is not
              stored on the server.
            </p>
          </div>
        )}

        {error && (
          <p
            data-testid="settings-api-key-error"
            role="alert"
            className="text-xs text-red-400"
          >
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-3">
          <button
            type="button"
            data-testid="generate-api-key-button"
            disabled={isGenerating}
            onClick={() => onGenerate()}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating
              ? "Generating..."
              : hasKey
                ? "Generate new key"
                : "Generate key via API"}
          </button>

          <button
            type="button"
            data-testid="revoke-api-key-button"
            disabled={!hasKey || isRevoking}
            onClick={() => onRevoke()}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRevoking ? "Revoking..." : "Revoke"}
          </button>

          {dirty && (
            <span
              data-testid="settings-api-key-unsaved"
              className="text-xs text-[var(--color-text-secondary)]"
            >
              Unsaved change — press Save to apply.
            </span>
          )}
        </div>
      </div>
    </SettingsCard>
  );
}
