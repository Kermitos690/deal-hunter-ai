import { Telegraf } from "telegraf";
import { serviceDb } from "@/lib/db/server";
import { enforcePlanLimits } from "@/plans/limits";
import { runRadarScan } from "@/lib/scans/run-radar-scan";
import { parseAuctionResponse } from "@/telegram/auction-response";

const steps = ["category", "brand", "budget", "condition", "source", "margin", "frequency"] as const;

async function userFor(ctx: any) {
  const telegramId = String(ctx.from.id);
  const role = telegramId === process.env.ADMIN_TELEGRAM_ID ? "admin" : "user";
  const { data, error } = await serviceDb()
    .from("users")
    .upsert(
      {
        telegram_id: telegramId,
        display_name: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ") || "Deal Hunter",
        role
      },
      { onConflict: "telegram_id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function setSession(telegramId: string, state: string, payload: Record<string, unknown> = {}) {
  await serviceDb().from("telegram_sessions").upsert({
    telegram_id: telegramId, state, payload, updated_at: new Date().toISOString()
  });
}

async function clearSession(telegramId: string) {
  await serviceDb().from("telegram_sessions").delete().eq("telegram_id", telegramId);
}

const questions: Record<(typeof steps)[number], string> = {
  category: "1/7 — Catégorie ? Exemple : montres, maroquinerie, accessoires.",
  brand: "2/7 — Marque recherchée ? Exemple : Omega, Prada, Louis Vuitton.",
  budget: "3/7 — Budget maximum d’achat en CHF ?",
  condition: "4/7 — États acceptés ? NEW, A, B, C ou REPAIR.",
  source: "5/7 — Source ? mock pour tester, ou ebay si configuré.",
  margin: "6/7 — Marge nette minimum souhaitée en CHF ?",
  frequency: "7/7 — Fréquence de scan en minutes ? Free : minimum 360."
};

export function createBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN manquant.");
  const bot = new Telegraf(token);

  bot.start(async (ctx) => {
    const user = await userFor(ctx);
    await ctx.reply(
      `Bienvenue ${user.display_name} 👋\n\nCrée tes radars privés et reçois uniquement tes opportunités.`,
      { reply_markup: { inline_keyboard: [
        [{ text: "➕ Créer un radar", callback_data: "create_radar" }],
        [{ text: "📡 Mes radars", callback_data: "list_radars" }],
        [{ text: "🌐 Dashboard", url: `${process.env.APP_BASE_URL}/login` }]
      ] } }
    );
  });
  bot.command("id", (ctx) => ctx.reply(String(ctx.from.id)));
  bot.command("help", (ctx) =>
    ctx.reply("/start /id /radars /newradar /alerts /deals /settings /stop /resume")
  );
  bot.command("newradar", async (ctx) => {
    await userFor(ctx);
    await setSession(String(ctx.from.id), "wizard:category", {});
    await ctx.reply(questions.category);
  });
  bot.action("create_radar", async (ctx) => {
    await ctx.answerCbQuery();
    await setSession(String(ctx.from.id), "wizard:category", {});
    await ctx.reply(questions.category);
  });

  async function listRadars(ctx: any) {
    const user = await userFor(ctx);
    const { data } = await serviceDb().from("radars").select("*").eq("user_id", user.id);
    const text = data?.length
      ? data.map((r: any) => `${r.is_active ? "🟢" : "⏸️"} ${r.name} — max ${r.max_buy_price} CHF`).join("\n")
      : "Aucun radar. Utilise /newradar.";
    await ctx.reply(text);
  }
  bot.command("radars", listRadars);
  bot.action("list_radars", async (ctx) => { await ctx.answerCbQuery(); await listRadars(ctx); });
  bot.command("alerts", async (ctx) => {
    const user = await userFor(ctx);
    const { data } = await serviceDb().from("alerts").select("id,status,sent_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10);
    await ctx.reply(data?.length ? data.map((a: any) => `• ${a.status} — ${a.sent_at ?? "en attente"}`).join("\n") : "Aucune alerte.");
  });
  bot.command("deals", async (ctx) => {
    const user = await userFor(ctx);
    const { data } = await serviceDb().from("deal_scores").select("total_score,recommendation,estimated_net_profit").eq("user_id", user.id).order("total_score", { ascending: false }).limit(10);
    await ctx.reply(data?.length ? data.map((d: any) => `⭐ ${d.total_score} — ${d.recommendation} — +${d.estimated_net_profit} CHF`).join("\n") : "Aucun deal.");
  });
  bot.command("settings", (ctx) => ctx.reply(`${process.env.APP_BASE_URL}/dashboard/settings`));
  bot.command("stop", async (ctx) => {
    const user = await userFor(ctx);
    await serviceDb().from("users").update({ alerts_enabled: false }).eq("id", user.id);
    await ctx.reply("⏸️ Alertes désactivées.");
  });
  bot.command("resume", async (ctx) => {
    const user = await userFor(ctx);
    await serviceDb().from("users").update({ alerts_enabled: true }).eq("id", user.id);
    await ctx.reply("▶️ Alertes réactivées.");
  });

  bot.on("text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    const telegramId = String(ctx.from.id);
    const { data: session } = await serviceDb()
      .from("telegram_sessions").select("*").eq("telegram_id", telegramId).maybeSingle();
    if (session?.state?.startsWith("auction:")) {
      const choice = parseAuctionResponse(ctx.message.text);
      if (!choice) {
        await ctx.reply("Réponds uniquement A pour le rappel ou B pour ignorer.");
        return;
      }
      const alertId = session.state.split(":")[1];
      if (choice === "REMIND") {
        const user = await userFor(ctx);
        const { data: alert } = await serviceDb().from("alerts").select("*").eq("id", alertId).eq("user_id", user.id).maybeSingle();
        if (alert) {
          const { data: product } = await serviceDb().from("products").select("auction_end_at").eq("id", alert.product_id).single();
          if (product?.auction_end_at) await serviceDb().from("auction_reminders").upsert({
            user_id: user.id, product_id: alert.product_id, radar_id: alert.radar_id,
            remind_at: new Date(new Date(product.auction_end_at).getTime() - 3_600_000).toISOString(), status: "pending"
          });
        }
      }
      await clearSession(telegramId);
      await ctx.reply(choice === "REMIND" ? "✅ Rappel créé 1h avant la fin." : "👌 Aucun rappel créé.");
      return;
    }
    if (!session?.state?.startsWith("wizard:")) return;
    const current = session.state.split(":")[1] as (typeof steps)[number];
    const index = steps.indexOf(current);
    const payload = { ...(session.payload ?? {}), [current]: ctx.message.text.trim() };
    if (index < steps.length - 1) {
      const next = steps[index + 1];
      await setSession(telegramId, `wizard:${next}`, payload);
      await ctx.reply(questions[next]);
      return;
    }
    const user = await userFor(ctx);
    const [{ count: activeRadars }, { count: alertsToday }] = await Promise.all([
      serviceDb().from("radars").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("is_active", true),
      serviceDb().from("alerts").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", new Date(Date.now() - 86400000).toISOString())
    ]);
    const limits = enforcePlanLimits(user, {
      activeRadars: activeRadars ?? 0,
      alertsToday: alertsToday ?? 0,
      requestedScanMinutes: Number(payload.frequency)
    });
    if (!limits.allowed) {
      await clearSession(telegramId);
      await ctx.reply(`❌ ${limits.errors.join(" ")}`);
      return;
    }
    const name = `${payload.brand} ${payload.category}`;
    const { error } = await serviceDb().from("radars").insert({
      user_id: user.id,
      name,
      category: payload.category,
      brands: [payload.brand],
      max_buy_price: Number(payload.budget),
      accepted_conditions: String(payload.condition).toUpperCase().split(/[, ]+/),
      sources: [String(payload.source).toLowerCase()],
      min_profit: Number(payload.margin),
      min_score: 70,
      scan_frequency_minutes: Number(payload.frequency),
      next_scan_at: new Date().toISOString()
    });
    await clearSession(telegramId);
    if (error) throw error;
    await ctx.reply(`✅ Radar créé : ${name}. Je vais chercher les opportunités correspondant à tes critères.`);
  });

  bot.action(/^scan:(.+)$/, async (ctx) => {
    const user = await userFor(ctx);
    await runRadarScan(ctx.match[1], user.id);
    await ctx.answerCbQuery("Scan terminé");
  });
  bot.action(/^(save|reject|remind|noremind|negotiate|analysis):(.+)$/, async (ctx) => {
    const user = await userFor(ctx);
    const action = ctx.match[1];
    const alertId = ctx.match[2];
    const { data: alert } = await serviceDb().from("alerts").select("*").eq("id", alertId).eq("user_id", user.id).maybeSingle();
    if (!alert) return ctx.answerCbQuery("Action refusée");
    if (action === "save") await serviceDb().from("saved_deals").upsert({ user_id: user.id, product_id: alert.product_id });
    if (action === "reject") await serviceDb().from("rejected_products").upsert({ user_id: user.id, product_id: alert.product_id, reason: "Telegram" });
    if (action === "remind") {
      const { data: product } = await serviceDb().from("products").select("auction_end_at").eq("id", alert.product_id).single();
      if (product?.auction_end_at) await serviceDb().from("auction_reminders").upsert({
        user_id: user.id, product_id: alert.product_id, radar_id: alert.radar_id,
        remind_at: new Date(new Date(product.auction_end_at).getTime() - 3_600_000).toISOString(), status: "pending"
      });
    }
    await serviceDb().from("alerts").update({ status: action }).eq("id", alertId).eq("user_id", user.id);
    await ctx.answerCbQuery("Action enregistrée");
  });
  return bot;
}
