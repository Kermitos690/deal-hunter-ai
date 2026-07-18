import { NextResponse } from "next/server";
import type { Update } from "telegraf/types";
import { jsonError } from "@/lib/api";
import { serviceDb } from "@/lib/db/server";
import { createBot } from "@/telegram/bot";
import {
  acknowledgeAdminInboxRefill,
  isAdminInboxRefillUpdate,
  runAdminInboxRefill
} from "@/telegram/admin-inbox-refill";
import { classifyTelegramWebhookPayload } from "@/telegram/webhook-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_TELEGRAM_WEBHOOK_BYTES = 512_000;

export async function POST(request: Request) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    console.warn("Webhook Telegram refusé : signature absente ou invalide.");
    return jsonError("Webhook refusé.", 401);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_TELEGRAM_WEBHOOK_BYTES) {
    return jsonError("Payload Telegram trop volumineux.", 413);
  }
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_TELEGRAM_WEBHOOK_BYTES) {
    return jsonError("Payload Telegram trop volumineux.", 413);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = null;
  }
  const parsed = classifyTelegramWebhookPayload(payload);
  if (!parsed.ok) return jsonError(parsed.error, parsed.status);

  const { update, updateId } = parsed;
  const db = serviceDb();
  const { error: claimError } = await db.from("processed_updates").insert({ update_id: updateId });
  if (claimError?.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
  if (claimError) return jsonError("Impossible d’enregistrer l’update.", 500);

  if (parsed.ignored) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    if (isAdminInboxRefillUpdate(update)) {
      const refill = await acknowledgeAdminInboxRefill(update);
      if (refill?.authorized) {
        // The callback is already acknowledged before the scans start. Keeping the
        // work awaited makes Vercel retain the invocation until the final Telegram
        // summary is sent. Telegram retries are harmless because processed_updates
        // rejects the duplicate update while this invocation is still running.
        await runAdminInboxRefill(refill);
      }
      return NextResponse.json({ ok: true, completed: Boolean(refill?.authorized) });
    }

    await createBot().handleUpdate(update as unknown as Update);
  } catch (error) {
    // The row is a processing claim, not proof of successful handling. Releasing it
    // lets Telegram retry the same update instead of losing it as a false duplicate.
    const { error: releaseError } = await db
      .from("processed_updates")
      .delete()
      .eq("update_id", updateId);
    if (releaseError) {
      console.error("Impossible de libérer l’update Telegram après échec:", releaseError.message);
    }
    console.error("Échec du traitement Telegram:", error instanceof Error ? error.message : "Erreur inconnue");
    return jsonError("Traitement Telegram impossible.", 500);
  }

  return NextResponse.json({ ok: true });
}
