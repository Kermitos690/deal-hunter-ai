import { Telegraf } from "telegraf";
import { serviceDb } from "@/lib/db/server";
import { enforcePlanLimits } from "@/plans/limits";
import { runRadarScan } from "@/lib/scans/run-radar-scan";
import { parseAuctionResponse } from "@/telegram/auction-response";
import { createSessionToken } from "@/lib/security/session";
import { categoryKeyboard, conditionKeyboard, frequencyKeyboard, parseBrands, positiveNumber, sourceKeyboard } from "@/telegram/radar-wizard";

const ACTIVE_RADAR_SOURCES = ["ebay", "email-alerts", "rss"];

export function parseRadarSources(value: string) {
  const normalized = value.trim().toLowerCase();
  if (["tout", "tous", "toutes", "all", "toutes sauf mock"].includes(normalized)) return ACTIVE_RADAR_SOURCES;
  const requested = normalized.split(/[,;\s]+/).filter(Boolean);
  return requested.length && requested.every((source) => ACTIVE_RADAR_SOURCES.includes(source))
    ? [...new Set(requested)]
    : null;
}

function dashboardLoginUrl(telegramId: string) {
  const token = encodeURIComponent(createSessionToken(telegramId, 15 * 60));
  return `${process.env.APP_BASE_URL}/api/auth/telegram/session?token=${token}`;
}

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

async function startRadarWizard(ctx:any) {
  await userFor(ctx);
  await setSession(String(ctx.from.id),"wizard:category",{});
  await ctx.reply("1/7 — Choisis une catégorie :",{reply_markup:categoryKeyboard});
}

export function createBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN manquant.");
  const bot = new Telegraf(token);

  bot.use(async (ctx, next) => {
    const telegramId = ctx.from?.id ? String(ctx.from.id) : null;
    if (telegramId) {
      const { data } = await serviceDb()
        .from("users")
        .select("status")
        .eq("telegram_id", telegramId)
        .maybeSingle();
      if (data?.status === "suspended") {
        await ctx.reply("⛔ Compte suspendu. Contacte l’administrateur.");
        return;
      }
    }
    return next();
  });

  bot.start(async (ctx) => {
    const user = await userFor(ctx);
    await ctx.reply(
      `Bienvenue ${user.display_name} 👋\n\nCrée tes radars privés et reçois uniquement tes opportunités.`,
      { reply_markup: { inline_keyboard: [
        [{ text: "➕ Créer un radar", callback_data: "create_radar" }],
        [{ text: "📡 Mes radars", callback_data: "list_radars" }],
        [{ text: "🌐 Dashboard", url: dashboardLoginUrl(String(ctx.from.id)) }]
      ] } }
    );
  });
  bot.command("id", (ctx) => ctx.reply(String(ctx.from.id)));
  bot.command("help", (ctx) =>
    ctx.reply("/start /id /radars /newradar /alerts /deals /settings /stop /resume")
  );
  bot.command("newradar", async (ctx) => {
    await startRadarWizard(ctx);
  });
  bot.action("create_radar", async (ctx) => {
    await ctx.answerCbQuery();
    await startRadarWizard(ctx);
  });

  bot.action(/^wizcat:(.+)$/,async(ctx)=>{
    const telegramId=String(ctx.from.id); const category=ctx.match[1];
    const {data:session}=await serviceDb().from("telegram_sessions").select("state").eq("telegram_id",telegramId).maybeSingle();
    if(session?.state!=="wizard:category") return ctx.answerCbQuery();
    await setSession(telegramId,"wizard:brand",{category}); await ctx.answerCbQuery();
    await ctx.reply("2/7 — Écris la ou les marques recherchées.\nExemple : Omega Rolex TAG Heuer\n\nLes virgules ne sont pas obligatoires.");
  });
  bot.action(/^wizcond:(.+)$/,async(ctx)=>{
    const telegramId=String(ctx.from.id); const {data:session}=await serviceDb().from("telegram_sessions").select("*").eq("telegram_id",telegramId).maybeSingle();
    if(session?.state!=="wizard:condition") return ctx.answerCbQuery();
    const payload={...(session.payload??{}),condition:ctx.match[1].split(",")};
    await setSession(telegramId,"wizard:source",payload); await ctx.answerCbQuery();
    await ctx.reply("5/7 — Choisis les sources à scanner :",{reply_markup:sourceKeyboard});
  });
  bot.action(/^wizsrc:(.+)$/,async(ctx)=>{
    const telegramId=String(ctx.from.id); const {data:session}=await serviceDb().from("telegram_sessions").select("*").eq("telegram_id",telegramId).maybeSingle();
    if(session?.state!=="wizard:source") return ctx.answerCbQuery();
    const sources=ctx.match[1]==="all"?ACTIVE_RADAR_SOURCES:["ebay"];
    await setSession(telegramId,"wizard:margin",{...(session.payload??{}),sources}); await ctx.answerCbQuery();
    await ctx.reply("6/7 — Indique la marge nette minimum souhaitée en CHF.\nExemple : 50");
  });
  bot.action(/^wizfreq:(360|720|1440)$/,async(ctx)=>{
    const telegramId=String(ctx.from.id); const {data:session}=await serviceDb().from("telegram_sessions").select("*").eq("telegram_id",telegramId).maybeSingle();
    if(session?.state!=="wizard:frequency") return ctx.answerCbQuery();
    const payload={...(session.payload??{}),frequency:Number(ctx.match[1])};
    const user=await userFor(ctx);
    const [{count:activeRadars},{count:alertsToday}]=await Promise.all([
      serviceDb().from("radars").select("*",{count:"exact",head:true}).eq("user_id",user.id).eq("is_active",true),
      serviceDb().from("alerts").select("*",{count:"exact",head:true}).eq("user_id",user.id).gte("created_at",new Date(Date.now()-86400000).toISOString())
    ]);
    const limits=enforcePlanLimits(user,{activeRadars:activeRadars??0,alertsToday:alertsToday??0,requestedScanMinutes:payload.frequency});
    if(!limits.allowed){await clearSession(telegramId);await ctx.answerCbQuery();return ctx.reply(`❌ ${limits.errors.join(" ")}`)}
    const brands=payload.brands as string[]; const name=`${brands.join(", ")} — ${payload.category}`;
    const {error}=await serviceDb().from("radars").insert({
      user_id:user.id,name,category:payload.category,brands,max_buy_price:payload.budget,
      accepted_conditions:payload.condition,sources:payload.sources,min_profit:payload.margin,
      sale_types:["BUY_NOW","AUCTION"],min_score:70,scan_frequency_minutes:payload.frequency,
      next_scan_at:new Date().toISOString()
    });
    await ctx.answerCbQuery();
    if(error){
      console.error("Création radar Telegram impossible:",error.message);
      await ctx.reply("❌ Le radar n’a pas pu être créé. Tes réponses sont conservées : appuie à nouveau sur la fréquence ou utilise /newradar.");
      return;
    }
    await clearSession(telegramId);
    await ctx.reply(`✅ Radar créé et activé\n\n📡 ${name}\n💰 Budget : ${payload.budget} CHF\n📈 Marge minimum : ${payload.margin} CHF\n⏱ Scan : toutes les ${payload.frequency/60} h`);
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
  bot.command("settings", (ctx) => ctx.reply(dashboardLoginUrl(String(ctx.from.id))));
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
    const current=session.state.split(":")[1];
    const payload={...(session.payload??{})};
    if(current==="brand"){
      const brands=parseBrands(ctx.message.text); if(!brands.length){await ctx.reply("Indique au moins une marque.");return}
      await setSession(telegramId,"wizard:budget",{...payload,brands});
      await ctx.reply(`Marques reconnues : ${brands.join(", ")}\n\n3/7 — Indique ton budget maximum en CHF.\nExemple : 1500`); return;
    }
    if(current==="budget"){
      const budget=positiveNumber(ctx.message.text); if(!budget){await ctx.reply("Budget invalide. Écris uniquement un montant positif, par exemple 1500.");return}
      await setSession(telegramId,"wizard:condition",{...payload,budget});
      await ctx.reply("4/7 — Choisis les états acceptés :",{reply_markup:conditionKeyboard}); return;
    }
    if(current==="margin"){
      const margin=positiveNumber(ctx.message.text); if(!margin){await ctx.reply("Marge invalide. Écris uniquement un montant positif, par exemple 50.");return}
      await setSession(telegramId,"wizard:frequency",{...payload,margin});
      await ctx.reply("7/7 — Choisis la fréquence de scan :",{reply_markup:frequencyKeyboard}); return;
    }
    await ctx.reply("Utilise les boutons affichés pour continuer la création du radar.");
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
