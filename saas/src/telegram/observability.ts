import { serviceDb } from "@/lib/db/server";

type TelegramEventPayload = Record<string, string | number | boolean | string[] | null | undefined>;

export function logTelegramEvent(action: string, actorUserId?: string | null, payload: TelegramEventPayload = {}) {
  const sanitizedPayload = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  );
  console.info("telegram_event", JSON.stringify({ action, actorUserId: actorUserId ?? null, ...sanitizedPayload }));
  void Promise.resolve(serviceDb().from("admin_logs").insert({
      actor_user_id: actorUserId ?? null,
      action,
      payload: sanitizedPayload
    }))
    .then(({ error }) => {
      if (error) console.warn("Telegram event log skipped:", error.message);
    })
    .catch((error: unknown) => {
      console.warn("Telegram event log skipped:", error instanceof Error ? error.message : "unknown");
    });
}
