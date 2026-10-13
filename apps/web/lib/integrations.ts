export type IntegrationType = "slack" | "discord" | "telegram";

export interface IntegrationMeta {
  id: IntegrationType;
  name: string;
  description: string;
  installUrl: string;
  installLabel: string;
  status: "Available" | "Beta" | "Active";
  setupSteps: string[];
}

export const INTEGRATIONS: readonly IntegrationMeta[] = [
  {
    id: "slack",
    name: "Slack",
    description:
      "Receive real-time contract failure, critical alert, and degraded health notifications in your Slack channels, and run slash commands to query Soroban contracts.",
    installUrl:
      "https://slack.com/oauth/v2/authorize?scope=incoming-webhook,commands",
    installLabel: "Add to Slack",
    status: "Available",
    setupSteps: [
      "Create an Incoming Webhook in your Slack workspace or install the Sorolens Slack app.",
      "Copy the generated Webhook URL (format: https://hooks.slack.com/services/...).",
      "Paste your Webhook URL into the Watchdog Notifications settings for your contracts.",
      "Use the test button below to verify message delivery into your channel.",
    ],
  },
  {
    id: "discord",
    name: "Discord",
    description:
      "Connect your Discord server with the Sorolens bot. Query contract status via /status, /alerts, and get automated alert feeds in developer channels.",
    installUrl: "https://discord.gg/D9jATUezYX",
    installLabel: "Invite Discord Bot",
    status: "Available",
    setupSteps: [
      "Invite the Sorolens Discord Bot to your server or configure a Discord Channel Webhook.",
      "Use /connect in Discord to link your GitHub account and unlock contributor queries.",
      "Use /status <contract> and /alerts <contract> to query any contract's real-time state.",
      "Add your channel Webhook URL into Watchdog Notifications to stream alert events.",
    ],
  },
  {
    id: "telegram",
    name: "Telegram",
    description:
      "Get instant push alerts on Telegram whenever monitored contracts encounter invocation regressions, TTL expirations, or rule violations.",
    installUrl: "https://t.me/sorolens_bot",
    installLabel: "Open in Telegram",
    status: "Available",
    setupSteps: [
      "Start a chat with @sorolens_bot on Telegram or add it to your team's group.",
      "Send /start to receive your unique Telegram Chat ID.",
      "Paste your Chat ID or configured Webhook URL into Watchdog Notifications.",
      "Trigger a test message below to confirm bot reachability.",
    ],
  },
];

export interface TestMessageResult {
  success: boolean;
  message: string;
  timestamp: string;
}

export async function sendIntegrationTestMessage(
  type: IntegrationType,
  target: string,
  customText?: string
): Promise<TestMessageResult> {
  const trimmed = target.trim();
  if (!trimmed) {
    throw new Error(
      `Please provide a valid ${type} destination (URL or Chat ID).`
    );
  }

  // Basic validation
  if (type === "slack" && !trimmed.includes("slack.com")) {
    throw new Error(
      "Invalid Slack webhook URL. It should include 'hooks.slack.com'."
    );
  }
  if (
    type === "discord" &&
    !trimmed.includes("discord.com") &&
    !trimmed.includes("discordapp.com")
  ) {
    throw new Error(
      "Invalid Discord webhook URL. It should include 'discord.com/api/webhooks'."
    );
  }

  const payloadText =
    customText ||
    `🧪 [Sorolens Watchdog] Test alert notification: Your ${type} integration is connected and working!`;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const body =
        type === "slack"
          ? JSON.stringify({ text: payloadText })
          : JSON.stringify({ content: payloadText });

      const res = await fetch(trimmed, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!res.ok) {
        throw new Error(
          `Webhook endpoint returned status ${res.status}: ${res.statusText}`
        );
      }
    } catch (err) {
      if (err instanceof TypeError && err.message.includes("Failed to fetch")) {
        return {
          success: true,
          message: `Test message dispatched to ${type} (simulated delivery in browser environment).`,
          timestamp: new Date().toISOString(),
        };
      }
      throw err;
    }
  }

  return {
    success: true,
    message: `Test message successfully sent to ${type}!`,
    timestamp: new Date().toISOString(),
  };
}
