type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
};

type TelegramBotInfo = {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
};

type TelegramWebhookInfo = {
  url?: string;
  pending_update_count?: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  allowed_updates?: string[];
};

export type TelegramHealth = {
  status: "healthy" | "degraded" | "misconfigured" | "unreachable";
  configured: boolean;
  botUsername: string | null;
  expectedBotUsername: string | null;
  botMatches: boolean | null;
  webhookUrl: string | null;
  expectedWebhookUrl: string | null;
  webhookMatches: boolean | null;
  pendingUpdateCount: number | null;
  lastErrorDate: string | null;
  lastErrorMessage: string | null;
  maxConnections: number | null;
  allowedUpdates: string[];
};

function normalizedUsername(value?: string | null) {
  const normalized = String(value ?? "").trim().replace(/^@/, "").toLowerCase();
  return normalized || null;
}

function baseHealth(status: TelegramHealth["status"]): TelegramHealth {
  return {
    status,
    configured: false,
    botUsername: null,
    expectedBotUsername: normalizedUsername(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME),
    botMatches: null,
    webhookUrl: null,
    expectedWebhookUrl: process.env.APP_BASE_URL
      ? `${process.env.APP_BASE_URL.replace(/\/$/, "")}/api/telegram/webhook`
      : null,
    webhookMatches: null,
    pendingUpdateCount: null,
    lastErrorDate: null,
    lastErrorMessage: null,
    maxConnections: null,
    allowedUpdates: []
  };
}

async function telegramApi<T>(token: string, method: string) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    signal: AbortSignal.timeout(5_000),
    cache: "no-store"
  });
  const body = await response.json().catch(() => null) as TelegramApiResponse<T> | null;
  if (!response.ok || !body?.ok || body.result === undefined) {
    throw new Error(`${method} failed with HTTP ${response.status}`);
  }
  return body.result;
}

export async function telegramHealth(): Promise<TelegramHealth> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const expectedWebhookUrl = process.env.APP_BASE_URL
    ? `${process.env.APP_BASE_URL.replace(/\/$/, "")}/api/telegram/webhook`
    : null;
  if (!token || !webhookSecret || !expectedWebhookUrl) return baseHealth("misconfigured");

  try {
    const [bot, webhook] = await Promise.all([
      telegramApi<TelegramBotInfo>(token, "getMe"),
      telegramApi<TelegramWebhookInfo>(token, "getWebhookInfo")
    ]);
    const expectedBotUsername = normalizedUsername(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME);
    const botUsername = normalizedUsername(bot.username);
    const botMatches = expectedBotUsername ? botUsername === expectedBotUsername : true;
    const webhookMatches = webhook.url === expectedWebhookUrl;
    const lastErrorDate = webhook.last_error_date
      ? new Date(webhook.last_error_date * 1000).toISOString()
      : null;
    const recentError = webhook.last_error_date
      ? Date.now() - webhook.last_error_date * 1000 < 24 * 60 * 60 * 1000
      : false;
    const pending = Number(webhook.pending_update_count ?? 0);
    const status = botMatches && webhookMatches && !recentError && pending < 20
      ? "healthy"
      : "degraded";

    return {
      status,
      configured: true,
      botUsername,
      expectedBotUsername,
      botMatches,
      webhookUrl: webhook.url ?? null,
      expectedWebhookUrl,
      webhookMatches,
      pendingUpdateCount: pending,
      lastErrorDate,
      lastErrorMessage: webhook.last_error_message?.slice(0, 240) ?? null,
      maxConnections: webhook.max_connections ?? null,
      allowedUpdates: webhook.allowed_updates ?? []
    };
  } catch (error) {
    console.error("Telegram health check failed:", error instanceof Error ? error.message : "unknown");
    return { ...baseHealth("unreachable"), configured: true };
  }
}
