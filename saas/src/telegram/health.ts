type TelegramApiEnvelope<T> = { ok: boolean; result?: T; description?: string };

type TelegramIdentity = { id: number; is_bot: boolean; username?: string };
type TelegramWebhookInfo = {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  allowed_updates?: string[];
};

async function telegramGet<T>(method: string): Promise<TelegramApiEnvelope<T>> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN manquant" };
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    });
    const body = await response.json().catch(() => null) as TelegramApiEnvelope<T> | null;
    if (!response.ok || !body?.ok) {
      return { ok: false, description: body?.description ?? `HTTP ${response.status}` };
    }
    return body;
  } catch (error) {
    return { ok: false, description: error instanceof Error ? error.message : "Erreur Telegram" };
  }
}

export async function telegramHealth() {
  const [identity, webhook] = await Promise.all([
    telegramGet<TelegramIdentity>("getMe"),
    telegramGet<TelegramWebhookInfo>("getWebhookInfo")
  ]);
  const expectedUrl = process.env.APP_BASE_URL
    ? `${process.env.APP_BASE_URL.replace(/\/$/, "")}/api/telegram/webhook`
    : null;
  const actualUrl = webhook.result?.url ?? null;
  return {
    configured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET),
    apiReachable: identity.ok && webhook.ok,
    botUsername: identity.result?.username ?? null,
    expectedUsername: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? null,
    identityMatches: !process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || identity.result?.username === process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME,
    webhookUrl: actualUrl,
    expectedWebhookUrl: expectedUrl,
    webhookMatches: Boolean(expectedUrl && actualUrl === expectedUrl),
    pendingUpdates: webhook.result?.pending_update_count ?? null,
    lastErrorAt: webhook.result?.last_error_date ? new Date(webhook.result.last_error_date * 1000).toISOString() : null,
    lastError: webhook.result?.last_error_message ?? identity.description ?? webhook.description ?? null,
    allowedUpdates: webhook.result?.allowed_updates ?? [],
    maxConnections: webhook.result?.max_connections ?? null
  };
}
