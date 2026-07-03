import { Telegraf } from "telegraf";
import { serviceDb } from "@/lib/db/server";

export async function runDueReminders() {
  const db = serviceDb();
  const { data, error } = await db
    .from("auction_reminders")
    .select("*, users(telegram_id), products(title,product_url,current_bid_price,price_amount), deal_scores(total_score)")
    .eq("status", "pending")
    .lte("remind_at", new Date().toISOString())
    .limit(100);
  if (error) throw error;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { processed: 0, skipped: data?.length ?? 0 };
  const bot = new Telegraf(token);
  let processed = 0;
  for (const reminder of data ?? []) {
    const telegramId = reminder.users?.telegram_id;
    if (!telegramId) continue;
    const product = reminder.products;
    await bot.telegram.sendMessage(
      telegramId,
      `⏰ RAPPEL ENCHÈRE — 1H AVANT LA FIN\n\nProduit : ${product.title}\nPrix actuel : ${product.current_bid_price ?? product.price_amount} CHF\nLien : ${product.product_url}\n\nNe dépasse pas ton prix maximum calculé et vérifie l’authenticité.`,
      { reply_markup: { inline_keyboard: [[{ text: "🔗 Ouvrir", url: product.product_url }]] } }
    );
    await db.from("auction_reminders").update({ status: "sent" }).eq("id", reminder.id).eq("user_id", reminder.user_id);
    processed += 1;
  }
  return { processed, skipped: 0 };
}
