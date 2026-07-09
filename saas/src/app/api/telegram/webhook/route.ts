import { NextResponse } from "next/server";
import type { Update } from "telegraf/types";
import { createBot } from "@/telegram/bot";
import { serviceDb } from "@/lib/db/server";
import { jsonError } from "@/lib/api";
import { classifyTelegramWebhookPayload } from "@/telegram/webhook-utils";

export async function POST(request: Request) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    console.warn("Webhook Telegram refusé : signature absente ou invalide.");
    return jsonError("Webhook refusé.", 401);
  }
  const parsed = classifyTelegramWebhookPayload(await request.json().catch(() => null));
  if (!parsed.ok) return jsonError(parsed.error, parsed.status);
  const { update, updateId } = parsed;
  const { error } = await serviceDb().from("processed_updates").insert({ update_id: updateId });
  if (error?.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
  if (error) return jsonError("Impossible d’enregistrer l’update.", 500);
  if (parsed.ignored) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  try {
    await createBot().handleUpdate(update as unknown as Update);
  } catch (error) {
    console.error("Échec du traitement Telegram:", error instanceof Error ? error.message : "Erreur inconnue");
    return jsonError("Traitement Telegram impossible.", 500);
  }
  return NextResponse.json({ ok: true });
}
