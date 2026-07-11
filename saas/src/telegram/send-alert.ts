import { Telegraf } from "telegraf";
import { formatTelegramAlert } from "./format-alert";
import { serviceDb } from "@/lib/db/server";
import type { DealScore, ProductCandidate, Radar } from "@/types";

export type TelegramAlertResult =
  | { messageId: string; skipped: false; reason?: never }
  | { messageId: null; skipped: true; reason: "telegram_token_missing" };

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
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { messageId: null, skipped: true, reason: "telegram_token_missing" };
  const bot = new Telegraf(token);
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
  const message = await bot.telegram.sendMessage(telegramId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔥 Top deals", callback_data: "inbox:top" }],
        [{ text: "⚡ Trier maintenant", callback_data: "deal_next" }],
        [{ text: "📡 Mes radars", callback_data: "list_radars" }, { text: "📥 Inbox", callback_data: "inbox" }]
      ]
    }
  });
  return { messageId: String(message.message_id), skipped: false };
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
  let message;
  try {
    message = photo
      ? await bot.telegram.sendPhoto(telegramId, photo, {
          caption: text.slice(0, 1000),
          reply_markup: buttons
        })
      : await bot.telegram.sendMessage(telegramId, text, { reply_markup: buttons });
  } catch (error) {
    console.error("Échec envoi alerte Telegram:", error instanceof Error ? error.message : "Erreur inconnue");
    throw error;
  }
  if (candidate.auctionEndAt) {
    await serviceDb().from("telegram_sessions").upsert({
      telegram_id: telegramId,
      state: `auction:${alertId}`,
      payload: {},
      updated_at: new Date().toISOString()
    });
    await bot.telegram.sendMessage(
      telegramId,
      "⏰ Enchère détectée. Réponds A pour un rappel 1h avant la fin, B pour ignorer.",
      { reply_markup: { inline_keyboard: [[
        { text: "A — Rappel 1h avant", callback_data: `remind:${alertId}` },
        { text: "B — Pas de rappel", callback_data: `noremind:${alertId}` }
      ]] } }
    );
  }
  return { messageId: String(message.message_id), skipped: false };
}
