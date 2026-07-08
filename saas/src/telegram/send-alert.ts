import { Telegraf } from "telegraf";
import { formatTelegramAlert } from "./format-alert";
import { serviceDb } from "@/lib/db/server";
import type { DealScore, ProductCandidate } from "@/types";

export type TelegramAlertResult =
  | { messageId: string; skipped: false; reason?: never }
  | { messageId: null; skipped: true; reason: "telegram_token_missing" };

export async function sendDealAlert(
  telegramId: string,
  alertId: string,
  candidate: ProductCandidate,
  score: DealScore
): Promise<TelegramAlertResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { messageId: null, skipped: true, reason: "telegram_token_missing" };
  const bot = new Telegraf(token);
  const buttons = {
    inline_keyboard: [
      [
        { text: "🔗 Ouvrir l’annonce", url: candidate.productUrl },
        { text: "✅ Sauvegarder", callback_data: `save:${alertId}` }
      ],
      [
        { text: "❌ Rejeter", callback_data: `reject:${alertId}` },
        { text: "📉 Négocier", callback_data: `negotiate:${alertId}` }
      ],
      [
        { text: "🔔 Me rappeler", callback_data: `remind:${alertId}` },
        { text: "🧾 Analyse complète", callback_data: `analysis:${alertId}` }
      ]
    ]
  };
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
