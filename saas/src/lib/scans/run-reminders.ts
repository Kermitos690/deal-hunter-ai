import { serviceDb } from "@/lib/db/server";
import { userCanRunActivity } from "@/lib/scans/scan-policy";
import { sendTelegramText } from "@/telegram/send-alert";

const MAX_REMINDER_ATTEMPTS = 3;

function permanentReminderFailure(reason: string) {
  return reason === "telegram_forbidden" ||
    reason === "telegram_bad_request" ||
    reason === "telegram_token_missing";
}

export async function runDueReminders() {
  const db = serviceDb();
  const { data, error } = await db
    .from("auction_reminders")
    .select("*, users(telegram_id,status), products(title,product_url,current_bid_price,price_amount)")
    .eq("status", "pending")
    .lt("attempt_count", MAX_REMINDER_ATTEMPTS)
    .lte("remind_at", new Date().toISOString())
    .order("remind_at", { ascending: true })
    .limit(100);
  if (error) throw error;

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  for (const reminder of data ?? []) {
    if (!userCanRunActivity(reminder.users?.status)) {
      await db.from("auction_reminders")
        .update({ status: "cancelled_user_suspended", last_error: "user_suspended" })
        .eq("id", reminder.id)
        .eq("user_id", reminder.user_id);
      skipped += 1;
      continue;
    }

    const telegramId = reminder.users?.telegram_id;
    if (!telegramId) {
      await db.from("auction_reminders")
        .update({ status: "failed_telegram_missing", last_error: "telegram_user_missing" })
        .eq("id", reminder.id)
        .eq("user_id", reminder.user_id);
      failed += 1;
      continue;
    }

    const product = reminder.products;
    const attemptCount = Number(reminder.attempt_count ?? 0) + 1;
    const result = await sendTelegramText(
      telegramId,
      `⏰ RAPPEL ENCHÈRE — 1H AVANT LA FIN\n\nProduit : ${product.title}\nPrix actuel : ${product.current_bid_price ?? product.price_amount} CHF\nLien : ${product.product_url}\n\nNe dépasse pas ton prix maximum calculé et vérifie l’authenticité.`,
      { reply_markup: { inline_keyboard: [[{ text: "🔗 Ouvrir", url: product.product_url }]] } }
    );

    if (!result.skipped) {
      const { error: updateError } = await db.from("auction_reminders").update({
        status: "sent",
        attempt_count: attemptCount,
        last_attempt_at: new Date().toISOString(),
        last_error: null
      }).eq("id", reminder.id).eq("user_id", reminder.user_id);
      if (updateError) throw updateError;
      processed += 1;
      continue;
    }

    const terminal = permanentReminderFailure(result.reason) || attemptCount >= MAX_REMINDER_ATTEMPTS;
    const { error: failureError } = await db.from("auction_reminders").update({
      status: terminal ? `failed_${result.reason}` : "pending",
      attempt_count: attemptCount,
      last_attempt_at: new Date().toISOString(),
      last_error: result.reason
    }).eq("id", reminder.id).eq("user_id", reminder.user_id);
    if (failureError) throw failureError;
    if (terminal) failed += 1;
    else skipped += 1;
  }
  return { processed, skipped, failed };
}
