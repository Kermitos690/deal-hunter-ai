import { Telegraf } from "telegraf";
import { serviceDb } from "@/lib/db/server";
import type { DealScore, ProductCandidate, Radar } from "@/types";
import { formatTelegramAlert } from "./format-alert";

export type TelegramFailureReason =
  | "telegram_token_missing"
  | "telegram_forbidden"
  | "telegram_bad_request"
  | "telegram_rate_limited"
  | "telegram_api_error";

export type TelegramAlertResult =
  | { messageId: string; skipped: false; reason?: never }
  | { messageId: null; skipped: true; reason: TelegramFailureReason };

type TelegramErrorShape = {
  code?: number;
  response?: {
    error_code?: number;
    description?: string;
    parameters?: { retry_after?: number };
  };
  message?: string;
};

function telegramErrorCode(error: unknown) {
  const shape = error as TelegramErrorShape | null;
  return Number(shape?.response?.error_code ?? shape?.code ?? 0);
}

function telegramRetryAfterMs(error: unknown) {
  const shape = error as TelegramErrorShape | null;
  const seconds = Number(shape?.response?.parameters?.retry_after ?? 0);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 5000) : 0;
}

export function classifyTelegramFailure(error: unknown): TelegramFailureReason {
  const code = telegramErrorCode(error);
  const description = String((error as TelegramErrorShape | null)?.response?.description ?? (error as Error | null)?.message ?? "").toLowerCase();
  if (code === 403 || /bot was blocked|forbidden|user is deactivated/.test(description)) return "telegram_forbidden";
  if (code === 400) return "telegram_bad_request";
  if (code === 429) return "telegram_rate_limited";
  return "telegram_api_error";
}

function isTransientTelegramFailure(error: unknown) {
  const code = telegramErrorCode(error);
  if (code === 429 || code >= 500) return true;
  const message = String((error as Error | null)?.message ?? "").toLowerCase();
  return /timeout|timed out|econnreset|econnrefused|fetch failed|network|socket/.test(message);
}

async function pause(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendWithRetry<T>(operation: () => Promise<T>, maxAttempts = 3): Promise<{ ok: true; value: T } | { ok: false; reason: TelegramFailureReason }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return { ok: true, value: await operation() };
    } catch (error) {
      lastError = error;
      if (!isTransientTelegramFailure(error) || attempt === maxAttempts) break;
      await pause(telegramRetryAfterMs(error) || Math.min(250 * 2 ** (attempt - 1), 1000));
    }
  }
  const reason = classifyTelegramFailure(lastError);
  console.error("Échec envoi Telegram:", reason);
  return { ok: false, reason };
}

export async function sendTelegramText(
  telegramId: string,
  text: string,
  extra?: Record<string, unknown>
): Promise<TelegramAlertResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { messageId: null, skipped: true, reason: "telegram_token_missing" };
  const bot = new Telegraf(token);
  const sent = await sendWithRetry(() => bot.telegram.sendMessage(telegramId, text, extra as any));
  return sent.ok
    ? { messageId: String(sent.value.message_id), skipped: false }
    : { messageId: null, skipped: true, reason: sent.reason };
}

export function dealAlertKeyboard(alertId: string, productUrl: string, hasAuctionEnd: boolean) {
  const actionRows = [
    [
      { text: "❌ Rejeter", callback_data: `reject:${alertId}` },
      { text: "📉 Négocier", callback_data: `negotiate:${alertId}` }
    ],
    hasAuctionEnd
      ? [
          { text: "🔔 Me rappeler", callback_data: `remind:${alertId}` },
          { text: "🧾 Analyse complète", callback_data: `analysis:${alertId}` }
        ]
      : [
          { text: "🧾 Analyse complète", callback_data: `analysis:${alertId}` }
        ]
  ];

  return {
    inline_keyboard: [
      [
        { text: "🔗 Ouvrir l’annonce", url: productUrl },
        { text: "✅ Sauvegarder", callback_data: `save:${alertId}` }
      ],
      ...actionRows
    ]
  };
}

export function dealReviewKeyboard(alertId: string, productUrl: string, hasAuctionEnd: boolean) {
  return {
    inline_keyboard: [
      [
        { text: "❌ Jeter", callback_data: `reject:${alertId}` },
        { text: "❤️ Garder", callback_data: `save:${alertId}` }
      ],
      [
        { text: "📉 Négocier", callback_data: `negotiate:${alertId}` },
        { text: "📊 Analyse", callback_data: `analysis:${alertId}` }
      ],
      [
        { text: "➡️ Deal suivant", callback_data: "deal_next" },
        { text: "📥 Inbox", callback_data: "inbox" }
      ],
      [
        { text: "🔗 Ouvrir", url: productUrl },
        ...(hasAuctionEnd ? [{ text: "🔔 Rappel", callback_data: `remind:${alertId}` }] : [])
      ]
    ]
  };
}

export async function sendScanDigest(
  telegramId: string,
  radar: Pick<Radar, "id" | "name">,
  result: { candidatesFound: number; alertsCreated: number; alertsSent: number; telegramSkipped?: number }
): Promise<TelegramAlertResult> {
  const text = [
    "📥 Nouveaux résultats prêts",
    "",
    `📡 Radar : ${radar.name}`,
    `🔎 ${result.candidatesFound} annonce(s) analysée(s)`,
    `🚨 ${result.alertsCreated} opportunité(s) à trier`,
    "",
    "Je ne t’envoie plus tout en vrac. Ouvre l’inbox et traite les deals un par un.",
    "",
    "_scan-digest-v1_"
  ].join("\n");
  return sendTelegramText(telegramId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔥 Top deals", callback_data: "inbox:top" }],
        [{ text: "⚡ Trier maintenant", callback_data: "deal_next" }],
        [{ text: "📡 Mes radars", callback_data: "list_radars" }, { text: "📥 Inbox", callback_data: "inbox" }]
      ]
    }
  });
}

export async function sendDealAlert(
  telegramId: string,
  alertId: string,
  candidate: ProductCandidate,
  score: DealScore
): Promise<TelegramAlertResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { messageId: null, skipped: true, reason: "telegram_token_missing" };
  const bot = new Telegraf(token);
  const buttons = dealAlertKeyboard(alertId, candidate.productUrl, Boolean(candidate.auctionEndAt));
  const text = formatTelegramAlert(candidate, score);
  const photo = candidate.imageUrls[0];
  const sent = photo
    ? await sendWithRetry(() => bot.telegram.sendPhoto(telegramId, photo, {
        caption: text.slice(0, 1000),
        reply_markup: buttons
      }))
    : await sendWithRetry(() => bot.telegram.sendMessage(telegramId, text, {
        reply_markup: buttons
      }));
  if (!sent.ok) return { messageId: null, skipped: true, reason: sent.reason };

  if (candidate.auctionEndAt) {
    await serviceDb().from("telegram_sessions").upsert({
      telegram_id: telegramId,
      state: `auction:${alertId}`,
      payload: {},
      updated_at: new Date().toISOString()
    });
    const followUp = await sendTelegramText(
      telegramId,
      "⏰ Enchère détectée. Réponds A pour un rappel 1h avant la fin, B pour ignorer.",
      { reply_markup: { inline_keyboard: [[
        { text: "A — Rappel 1h avant", callback_data: `remind:${alertId}` },
        { text: "B — Pas de rappel", callback_data: `noremind:${alertId}` }
      ]] } }
    );
    if (followUp.skipped) console.warn("Message de suivi enchère non envoyé:", followUp.reason);
  }
  return { messageId: String(sent.value.message_id), skipped: false };
}
