"use client";

import { useState } from "react";
import Link from "next/link";
import {
  INTEGRATIONS,
  sendIntegrationTestMessage,
  type IntegrationType,
  type TestMessageResult,
} from "@/lib/integrations";

export default function IntegrationsPage() {
  const [testInputs, setTestInputs] = useState<Record<string, string>>({
    slack: "https://hooks.slack.com/services/T00/B00/XXXXX",
    discord: "https://discord.com/api/webhooks/000/XXXXX",
    telegram: "123456789",
  });

  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<
    Record<string, TestMessageResult | null>
  >({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const handleTestSend = async (type: IntegrationType) => {
    setLoading((prev) => ({ ...prev, [type]: true }));
    setErrors((prev) => ({ ...prev, [type]: null }));
    setResults((prev) => ({ ...prev, [type]: null }));

    try {
      const destination = testInputs[type] || "";
      const res = await sendIntegrationTestMessage(type, destination);
      setResults((prev) => ({ ...prev, [type]: res }));
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [type]:
          err instanceof Error ? err.message : "Failed to send test message",
      }));
    } finally {
      setLoading((prev) => ({ ...prev, [type]: false }));
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
              Integrations
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Connect Slack, Discord, and Telegram to monitor Soroban smart
              contracts, receive alert streams, and execute slash commands.
            </p>
          </div>
          <Link
            href="/watchdog/notifications"
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent)]"
          >
            Manage Watchdog Notifications →
          </Link>
        </div>
      </div>

      {/* Integration Cards */}
      <div className="space-y-6">
        {INTEGRATIONS.map((integration) => {
          const type = integration.id;
          const isLoading = loading[type] ?? false;
          const result = results[type];
          const error = errors[type];

          return (
            <div
              key={integration.id}
              data-testid={`integration-card-${integration.id}`}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-border)] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      {integration.name}
                    </h2>
                    <span
                      data-testid={`status-${integration.id}`}
                      className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20"
                    >
                      {integration.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)] max-w-2xl">
                    {integration.description}
                  </p>
                </div>

                <a
                  href={integration.installUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`install-link-${integration.id}`}
                  className="rounded-md bg-[var(--color-accent)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-bg-page)] transition-opacity hover:opacity-90"
                >
                  {integration.installLabel} ↗
                </a>
              </div>

              {/* Setup Steps */}
              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Setup Instructions
                </h3>
                <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-[var(--color-text-primary)]">
                  {integration.setupSteps.map((step, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              {/* Test Message Widget */}
              <div className="mt-6 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-page)] p-4">
                <h4 className="text-xs font-semibold text-[var(--color-text-primary)]">
                  Send a Test Message
                </h4>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                  Test your webhook or chat destination before enabling
                  automated alerts.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    data-testid={`test-input-${integration.id}`}
                    value={testInputs[type] ?? ""}
                    onChange={(e) =>
                      setTestInputs((prev) => ({
                        ...prev,
                        [type]: e.target.value,
                      }))
                    }
                    placeholder={
                      type === "telegram"
                        ? "Enter Telegram Chat ID"
                        : "Enter Webhook URL"
                    }
                    className="flex-1 min-w-[280px] rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 font-mono text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
                  />
                  <button
                    type="button"
                    data-testid={`test-send-button-${integration.id}`}
                    disabled={isLoading}
                    onClick={() => handleTestSend(type)}
                    className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? "Sending..." : "Send Test Message"}
                  </button>
                </div>

                {/* Status Feedback */}
                {result && (
                  <div
                    data-testid={`test-success-${integration.id}`}
                    role="status"
                    className="mt-3 rounded border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-300"
                  >
                    ✓ {result.message}
                  </div>
                )}

                {error && (
                  <div
                    data-testid={`test-error-${integration.id}`}
                    role="alert"
                    className="mt-3 rounded border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300"
                  >
                    ✕ {error}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
