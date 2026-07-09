export type TelegramWebhookPayloadState =
  | { ok: true; update: Record<string, unknown>; updateId: number; ignored: boolean }
  | { ok: false; status: 400; error: string };

export function classifyTelegramWebhookPayload(payload: unknown): TelegramWebhookPayloadState {
  if (!payload || typeof payload !== "object") {
    return { ok: false, status: 400, error: "Payload Telegram invalide." };
  }
  const update = payload as Record<string, unknown>;
  const updateId = Number(update.update_id);
  if (!Number.isFinite(updateId)) {
    return { ok: false, status: 400, error: "Update Telegram invalide." };
  }
  return {
    ok: true,
    update,
    updateId,
    ignored: !update.message && !update.callback_query
  };
}
