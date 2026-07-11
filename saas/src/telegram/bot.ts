import { Telegraf } from "telegraf";
import { serviceDb } from "@/lib/db/server";
import { enforcePlanLimits } from "@/plans/limits";
import { runRadarScan } from "@/lib/scans/run-radar-scan";
import { parseAuctionResponse } from "@/telegram/auction-response";
import { createSessionToken } from "@/lib/security/session";
import { formatFullDealAnalysis } from "@/telegram/full-analysis";
import { scanResultText } from "@/telegram/scan-result-text";
import { alertStatusForTelegramAction, isTelegramDealAction, type TelegramDealAction } from "@/telegram/deal-actions";
import { looksLikeWhatsAppPhone, normalizeWhatsAppPhone } from "@/whatsapp/client";
import { categoryKeyboard, categorySearchPrompt, conditionKeyboard, frequencyKeyboard, parseSearchIntent, positiveNumber, recommendedTelegramSources, searchSuggestionAt, searchSuggestionKeyboard, sourceSelectionKeyboard, TELEGRAM_SOURCE_OPTIONS } from "@/telegram/radar-wizard";
import { mainMenuKeyboard, mainMenuText } from "@/telegram/menu";
import { logTelegramEvent } from "@/telegram/observability";
import { dealReviewKeyboard } from "@/telegram/send-alert";

const ACTIVE_RADAR_SOURCES = ["ebay", "ricardo", "anibis", "tutti", "komehyo", "email-alerts", "rss"];
export { scanResultText } from "@/telegram/scan-result-text";

async function safeAnswerCbQuery(ctx: any, text?: string, extra?: Record<string, unknown>) {
  try {
    await ctx.answerCbQuery(text, extra);
  } catch (error) {
    console.warn("Callback Telegram non acquittable:", error instanceof Error ? error.message : error);
  }
}

async function scanAndReply(ctx: any, radarId: string, userId: string) {
  await logTelegramEvent("radar_scan_started", userId, { radar_id: radarId });
  await ctx.reply("🔎 Scan en cours… Les sources sélectionnées sont interrogées.");
  try {
    const result = await runRadarScan(radarId, userId);
    await logTelegramEvent("radar_scan_completed", userId, {
      radar_id: radarId,
      candidates_found: result.candidatesFound,
      alerts_sent: result.alertsSent,
      skipped: Boolean(result.skipped)
    });
    await ctx.reply(scanResultText(result), {
      reply_markup: { inline_keyboard: [
        [{ text: "📡 Mes radars", callback_data: "list_radars" }],
        [{ text: "🌐 Dashboard", url: dashboardLoginUrl(String(ctx.from.id)) }]
      ] }
    });
  } catch (error) {
    console.error("Scan Telegram impossible:", error);
    await logTelegramEvent("radar_scan_failed", userId, {
      radar_id: radarId,
      error: error instanceof Error ? error.message.slice(0, 180) : "unknown"
    });
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    await ctx.reply(`⚠️ Scan impossible pour le moment.\n\nDétail : ${message}\n\nTu peux le relancer depuis « Mes radars ».`, {
      reply_markup: { inline_keyboard: [[{ text: "📡 Mes radars", callback_data: "list_radars" }]] }
    });
  }
}

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

function startPayload(ctx: any) {
  return String(ctx.startPayload ?? ctx.payload ?? ctx.message?.text?.split(/\s+/)[1] ?? "").trim().toLowerCase();
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

function searchIntentLines(intent: ReturnType<typeof parseSearchIntent>) {
  return [
    intent.brands.length ? `Marques : ${intent.brands.join(", ")}` : null,
    intent.models.length ? `Modèles : ${intent.models.join(", ")}` : null,
    intent.includeKeywords.length ? `Mots-clés : ${intent.includeKeywords.join(", ")}` : null
  ].filter(Boolean).join("\n");
}

async function acceptWizardSearch(ctx: any, telegramId: string, payload: Record<string, unknown>, query: string) {
  const intent=parseSearchIntent(query, payload.category as string);
  if(!intent.brands.length && !intent.models.length && !intent.includeKeywords.length){await ctx.reply("Indique au moins une marque, un modèle ou un mot-clé utile.");return}
  await setSession(telegramId,"wizard:budget",{...payload,brands:intent.brands,models:intent.models,include_keywords:intent.includeKeywords,exclude_keywords:intent.excludeKeywords});
  await ctx.reply(`✅ Recherche comprise\n${searchIntentLines(intent)}\n\n3/7 — Indique ton budget maximum en CHF.\nExemple : 1500`);
}

async function replyWithFullAnalysis(ctx: any, alert: any) {
  const [{ data: product }, { data: score }] = await Promise.all([
    serviceDb().from("products").select("*").eq("id", alert.product_id).maybeSingle(),
    serviceDb().from("deal_scores").select("*").eq("id", alert.deal_score_id).maybeSingle()
  ]);
  if (!product || !score) {
    await safeAnswerCbQuery(ctx,"Analyse indisponible");
    await ctx.reply("⚠️ Analyse complète indisponible pour cette alerte. Le produit ou le score n’est plus accessible.");
    return;
  }
  const { data: comparables } = await serviceDb()
    .from("deal_score_comparables")
    .select("source,title,price,currency,evidence_url,confidence,match_score")
    .eq("deal_score_id", score.id)
    .order("weight", { ascending: false })
    .limit(5);
  await safeAnswerCbQuery(ctx,"Analyse envoyée");
  await ctx.reply(formatFullDealAnalysis(product, score, comparables ?? []), { disable_web_page_preview: true });
}

async function loadDealContext(alert: any) {
  const [{ data: product }, { data: score }] = await Promise.all([
    serviceDb().from("products").select("*").eq("id", alert.product_id).maybeSingle(),
    serviceDb().from("deal_scores").select("*").eq("id", alert.deal_score_id).maybeSingle()
  ]);
  return { product, score };
}

function money(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? `${Math.round(amount)} CHF` : "—";
}

function compactDealText(alert: any) {
  const product = Array.isArray(alert.products) ? alert.products[0] : alert.products;
  const score = Array.isArray(alert.deal_scores) ? alert.deal_scores[0] : alert.deal_scores;
  return [
    "⚡ Deal à trier",
    "",
    `📦 ${product?.title ?? "Annonce"}`,
    `🌍 ${product?.source ?? "source"} · ${money(product?.price_amount)}`,
    `⭐ Score : ${score?.total_score ?? "—"}/100`,
    `🟢 Marge : ${money(score?.estimated_net_profit)}`,
    score?.estimated_roi_percent != null ? `📊 ROI : ${Number(score.estimated_roi_percent).toFixed(1)} %` : null,
    "",
    "Swipe Telegram : ❌ jeter, ❤️ garder, ➡️ deal suivant."
  ].filter(Boolean).join("\n");
}

function imageUrlsForDealAlert(alert: any) {
  const product = Array.isArray(alert.products) ? alert.products[0] : alert.products;
  const images = Array.isArray(product?.product_images) ? product.product_images : [];
  return images
    .slice()
    .sort((a: any, b: any) => Number(a?.position ?? 0) - Number(b?.position ?? 0))
    .map((image: any) => String(image?.image_url ?? "").trim())
    .filter((url: string) => /^https?:\/\//i.test(url))
    .filter((url: string, index: number, all: string[]) => all.indexOf(url) === index)
    .slice(0, 10);
}

async function replyDealCard(ctx: any, alert: any) {
  const product = Array.isArray(alert.products) ? alert.products[0] : alert.products;
  const text = compactDealText(alert);
  const reply_markup = dealReviewKeyboard(alert.id, product?.product_url ?? "https://t.me", Boolean(product?.auction_end_at));
  const images = imageUrlsForDealAlert(alert);
  if (images.length > 1) {
    try {
      await ctx.replyWithMediaGroup(images.map((url: string, index: number) => ({
        type: "photo",
        media: url,
        ...(index === 0 ? { caption: text.slice(0, 1000) } : {})
      })));
      await ctx.reply("Actions rapides pour ce deal :", { reply_markup });
      return;
    } catch (error) {
      console.error("Échec envoi album Telegram:", error instanceof Error ? error.message : "Erreur inconnue");
    }
  }
  if (images.length === 1) {
    try {
      await ctx.replyWithPhoto(images[0], {
        caption: text.slice(0, 1000),
        reply_markup
      });
      return;
    } catch (error) {
      console.error("Échec envoi photo Telegram:", error instanceof Error ? error.message : "Erreur inconnue");
    }
  }
  await ctx.reply(text, {
    disable_web_page_preview: true,
    reply_markup
  });
}

function negotiationReply(product: any, score: any) {
  return `📉 Négociation préparée

Produit : ${product?.title ?? "Annonce"}
Offre maximum conseillée : ${money(score?.maximum_offer)}
Marge estimée actuelle : ${money(score?.estimated_net_profit)}
ROI estimé : ${score?.estimated_roi_percent != null ? `${Number(score.estimated_roi_percent).toFixed(1)} %` : "—"}

Plan :
${score?.action_plan ?? "Négocie sous l’offre maximum, vérifie l’état, les frais et l’authenticité avant paiement."}`;
}

async function updateAlertStatus(alertId: string, userId: string, status: string) {
  const { error } = await serviceDb().from("alerts").update({ status }).eq("id", alertId).eq("user_id", userId);
  if (error) throw error;
}

async function startRadarWizard(ctx:any) {
  const user = await userFor(ctx);
  await logTelegramEvent("radar_creation_started", user.id);
  await setSession(String(ctx.from.id),"wizard:category",{});
  await ctx.reply("1/7 — Choisis une catégorie :",{reply_markup:categoryKeyboard});
}

async function replyMainMenu(ctx: any) {
  const user = await userFor(ctx);
  await logTelegramEvent("telegram_menu_opened", user.id);
  await ctx.reply(mainMenuText(user.display_name), { reply_markup: mainMenuKeyboard(dashboardLoginUrl(String(ctx.from.id))) });
}

async function replyExpiredWizardStep(ctx: any) {
  const user = await userFor(ctx);
  await logTelegramEvent("telegram_callback_expired", user.id);
  await safeAnswerCbQuery(ctx, "Étape expirée", { show_alert: true });
  await ctx.reply("Ce bouton a expiré. Recommence la création du radar pour éviter une mauvaise configuration.", {
    reply_markup: { inline_keyboard: [[{ text: "➕ Recommencer le radar", callback_data: "create_radar" }]] }
  });
}

async function safeEditMessageReplyMarkup(ctx: any, replyMarkup: any) {
  try {
    await ctx.editMessageReplyMarkup(replyMarkup);
  } catch (error) {
    console.warn("Clavier Telegram non modifiable:", error instanceof Error ? error.message : error);
  }
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
    const payload = startPayload(ctx);
    if (payload === "newradar") {
      await startRadarWizard(ctx);
      return;
    }
    if (payload === "radars") {
      await listRadars(ctx);
      return;
    }
    if (payload === "deals") {
      await replyDeals(ctx);
      return;
    }
    if (payload === "alerts") {
      await replyAlerts(ctx);
      return;
    }
    await replyMainMenu(ctx);
  });
  bot.command("id", (ctx) => ctx.reply(String(ctx.from.id)));
  bot.command("menu", replyMainMenu);
  bot.command("help", (ctx) =>
    ctx.reply([
      "Commandes disponibles :",
      "/menu — menu principal",
      "/newradar — créer un radar",
      "/radars — voir et scanner tes radars",
      "/inbox — trier les opportunités par catégories",
      "/alerts — dernières alertes",
      "/deals — meilleures opportunités",
      "/status — état du compte",
      "/settings — ouvrir le dashboard",
      "/stop — suspendre les alertes",
      "/resume — réactiver les alertes"
    ].join("\n"))
  );
  bot.command("whatsapp", async (ctx) => {
    const phone = ctx.message.text.replace(/^\/whatsapp(@\w+)?/i, "").trim();
    if (!looksLikeWhatsAppPhone(phone)) {
      await ctx.reply("Écris ton numéro au format international. Exemple : /whatsapp +41791234567");
      return;
    }
    const user = await userFor(ctx);
    const normalizedPhone = normalizeWhatsAppPhone(phone);
    const { error } = await serviceDb().from("users").update({
      whatsapp_phone: normalizedPhone,
      whatsapp_alerts_enabled: true,
      whatsapp_opt_in_at: new Date().toISOString()
    }).eq("id", user.id);
    if (error) {
      console.error("Liaison WhatsApp impossible:", error.message);
      await ctx.reply("❌ Impossible de lier WhatsApp. Vérifie que la migration Supabase WhatsApp est appliquée.");
      return;
    }
    await ctx.reply(`✅ WhatsApp lié au +${normalizedPhone}.\n\nTu peux maintenant écrire au bot WhatsApp : aide, radars ou scan.`);
  });
  bot.command("newradar", async (ctx) => {
    await startRadarWizard(ctx);
  });
  bot.action("create_radar", async (ctx) => {
    await safeAnswerCbQuery(ctx);
    await startRadarWizard(ctx);
  });

  bot.action(/^wizcat:(.+)$/,async(ctx)=>{
    const telegramId=String(ctx.from.id); const category=ctx.match[1];
    const {data:session}=await serviceDb().from("telegram_sessions").select("state").eq("telegram_id",telegramId).maybeSingle();
    if(session?.state!=="wizard:category") return replyExpiredWizardStep(ctx);
    await setSession(telegramId,"wizard:brand",{category}); await safeAnswerCbQuery(ctx);
    await ctx.reply(categorySearchPrompt(category), { reply_markup: searchSuggestionKeyboard(category) });
  });
  bot.action(/^wizsearch:(\d+)$/,async(ctx)=>{
    const telegramId=String(ctx.from.id); const {data:session}=await serviceDb().from("telegram_sessions").select("*").eq("telegram_id",telegramId).maybeSingle();
    if(session?.state!=="wizard:brand") return replyExpiredWizardStep(ctx);
    const payload={...(session.payload??{})};
    const suggestion=searchSuggestionAt(String(payload.category ?? ""), Number(ctx.match[1]));
    if(!suggestion){await safeAnswerCbQuery(ctx,"Suggestion indisponible");return}
    await safeAnswerCbQuery(ctx,suggestion);
    await acceptWizardSearch(ctx, telegramId, payload, suggestion);
  });
  bot.action(/^wizcond:(.+)$/,async(ctx)=>{
    const telegramId=String(ctx.from.id); const {data:session}=await serviceDb().from("telegram_sessions").select("*").eq("telegram_id",telegramId).maybeSingle();
    if(session?.state!=="wizard:condition") return replyExpiredWizardStep(ctx);
    const payload={...(session.payload??{}),condition:ctx.match[1].split(","),sourcesDraft:recommendedTelegramSources()};
    await setSession(telegramId,"wizard:source",payload); await safeAnswerCbQuery(ctx);
    await ctx.reply("5/7 — Coche les sources à scanner.\n\nPack recommandé activé : eBay, Komehyo, Tutti, Email alerts.\nRicardo et Anibis sont disponibles en bêta, mais peuvent être instables.",{reply_markup:sourceSelectionKeyboard(payload.sourcesDraft)});
  });
  bot.action(/^wizsrcpreset:recommended$/,async(ctx)=>{
    const telegramId=String(ctx.from.id); const {data:session}=await serviceDb().from("telegram_sessions").select("*").eq("telegram_id",telegramId).maybeSingle();
    if(session?.state!=="wizard:source") return replyExpiredWizardStep(ctx);
    const payload={...(session.payload??{}),sourcesDraft:recommendedTelegramSources()};
    await setSession(telegramId,"wizard:source",payload);
    const user = await userFor(ctx);
    await logTelegramEvent("radar_sources_selected", user.id, { sources: payload.sourcesDraft });
    await safeAnswerCbQuery(ctx,"Pack recommandé sélectionné");
    await safeEditMessageReplyMarkup(ctx, sourceSelectionKeyboard(payload.sourcesDraft));
  });
  bot.action(/^wizsrctoggle:(.+)$/,async(ctx)=>{
    const telegramId=String(ctx.from.id); const {data:session}=await serviceDb().from("telegram_sessions").select("*").eq("telegram_id",telegramId).maybeSingle();
    if(session?.state!=="wizard:source") return replyExpiredWizardStep(ctx);
    const source=ctx.match[1];
    if(!TELEGRAM_SOURCE_OPTIONS.some((option)=>option.id===source)){await safeAnswerCbQuery(ctx,"Source inconnue");return}
    const current = new Set(((session.payload?.sourcesDraft as string[] | undefined) ?? recommendedTelegramSources()).filter((value)=>ACTIVE_RADAR_SOURCES.includes(value)));
    if(current.has(source)) current.delete(source); else current.add(source);
    const sourcesDraft=[...current];
    const payload={...(session.payload??{}),sourcesDraft};
    await setSession(telegramId,"wizard:source",payload);
    const user = await userFor(ctx);
    await logTelegramEvent("radar_sources_selected", user.id, { sources: sourcesDraft });
    await safeAnswerCbQuery(ctx,sourcesDraft.includes(source) ? "Source ajoutée" : "Source retirée");
    await safeEditMessageReplyMarkup(ctx, sourceSelectionKeyboard(sourcesDraft));
  });
  bot.action("wizsrcdone",async(ctx)=>{
    const telegramId=String(ctx.from.id); const {data:session}=await serviceDb().from("telegram_sessions").select("*").eq("telegram_id",telegramId).maybeSingle();
    if(session?.state!=="wizard:source") return replyExpiredWizardStep(ctx);
    const sources=(((session.payload?.sourcesDraft as string[] | undefined) ?? recommendedTelegramSources()).filter((value)=>ACTIVE_RADAR_SOURCES.includes(value)));
    if(!sources.length){await safeAnswerCbQuery(ctx,"Choisis au moins une source",{show_alert:true});return}
    const user = await userFor(ctx);
    await logTelegramEvent("radar_sources_selected", user.id, { sources });
    await setSession(telegramId,"wizard:margin",{...(session.payload??{}),sources}); await safeAnswerCbQuery(ctx,"Sources validées");
    await ctx.reply(`✅ Sources sélectionnées : ${sources.join(", ")}\n\n6/7 — Indique la marge nette minimum souhaitée en CHF.\nExemple : 50\n\nAstuce : mets 1 pour explorer très large, puis resserre ensuite.`);
  });
  bot.action(/^wizsrc:(.+)$/,async(ctx)=>{
    const telegramId=String(ctx.from.id); const {data:session}=await serviceDb().from("telegram_sessions").select("*").eq("telegram_id",telegramId).maybeSingle();
    if(session?.state!=="wizard:source") return replyExpiredWizardStep(ctx);
    const sources=ctx.match[1]==="all"?recommendedTelegramSources():[ctx.match[1]];
    await setSession(telegramId,"wizard:margin",{...(session.payload??{}),sources}); await safeAnswerCbQuery(ctx);
    await ctx.reply("6/7 — Indique la marge nette minimum souhaitée en CHF.\nExemple : 50\n\nAstuce : mets 1 pour explorer très large, puis resserre ensuite.");
  });
  bot.action(/^wizfreq:(360|720|1440)$/,async(ctx)=>{
    const telegramId=String(ctx.from.id); const {data:session}=await serviceDb().from("telegram_sessions").select("*").eq("telegram_id",telegramId).maybeSingle();
    if(session?.state!=="wizard:frequency") return replyExpiredWizardStep(ctx);
    const payload={...(session.payload??{}),frequency:Number(ctx.match[1])};
    const user=await userFor(ctx);
    const [{count:activeRadars},{count:alertsToday}]=await Promise.all([
      serviceDb().from("radars").select("*",{count:"exact",head:true}).eq("user_id",user.id).eq("is_active",true),
      serviceDb().from("alerts").select("*",{count:"exact",head:true}).eq("user_id",user.id).gte("created_at",new Date(Date.now()-86400000).toISOString())
    ]);
    const limits=enforcePlanLimits(user,{activeRadars:activeRadars??0,alertsToday:alertsToday??0,requestedScanMinutes:payload.frequency});
    if(!limits.allowed){await clearSession(telegramId);await safeAnswerCbQuery(ctx);return ctx.reply(`❌ ${limits.errors.join(" ")}`)}
    const brands=(payload.brands as string[] | undefined) ?? [];
    const models=(payload.models as string[] | undefined) ?? [];
    const includeKeywords=(payload.include_keywords as string[] | undefined) ?? [];
    const titleBits = brands.length ? brands : models.length ? models.slice(0, 3) : includeKeywords.slice(0, 3);
    const name=`${titleBits.length ? titleBits.join(", ") : "Radar"} — ${payload.category}`;
    const {data:createdRadar,error}=await serviceDb().from("radars").insert({
      user_id:user.id,name,category:payload.category,brands,models,include_keywords:includeKeywords,
      exclude_keywords:(payload.exclude_keywords as string[] | undefined) ?? [],max_buy_price:payload.budget,
      accepted_conditions:payload.condition,sources:payload.sources,min_profit:payload.margin,
      sale_types:["BUY_NOW","AUCTION"],min_score:70,scan_frequency_minutes:payload.frequency,
      next_scan_at:new Date().toISOString()
    }).select("id").single();
    await safeAnswerCbQuery(ctx);
    if(error){
      console.error("Création radar Telegram impossible:",error.message);
      await ctx.reply("❌ Le radar n’a pas pu être créé. Tes réponses sont conservées : appuie à nouveau sur la fréquence ou utilise /newradar.");
      return;
    }
    await clearSession(telegramId);
    await logTelegramEvent("radar_created", user.id, {
      radar_id: createdRadar.id,
      sources: ((payload.sources as string[]) ?? [])
    });
    await ctx.reply(`✅ Radar créé et activé\n\n📡 ${name}\n💰 Budget : ${payload.budget} CHF\n📈 Marge minimum : ${payload.margin} CHF\n🧭 Sources : ${((payload.sources as string[]) ?? []).join(", ")}\n⏱ Scan : toutes les ${payload.frequency/60} h`, {
      reply_markup: { inline_keyboard: [
        [{ text: "📡 Mes radars", callback_data: "list_radars" }],
        [{ text: "🌐 Dashboard", url: dashboardLoginUrl(String(ctx.from.id)) }]
      ] }
    });
    await scanAndReply(ctx, createdRadar.id, user.id);
  });

  async function listRadars(ctx: any) {
    const user = await userFor(ctx);
    const { data } = await serviceDb().from("radars").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    const text = data?.length
      ? `📡 Tes radars\n\n${data.map((r: any) => `${r.is_active ? "🟢" : "⏸️"} ${r.name}\n   max ${r.max_buy_price} CHF • sources ${Array.isArray(r.sources) ? r.sources.join(", ") : "—"}`).join("\n\n")}`
      : "Aucun radar. Utilise /newradar.";
    const activeRows = data?.filter((radar:any) => radar.is_active).slice(0, 8).map((radar:any) => [
      { text: `🔎 Scanner ${radar.name.slice(0, 34)}`, callback_data: `scan:${radar.id}` }
    ]) ?? [];
    await ctx.reply(text, { reply_markup: { inline_keyboard: [
      ...activeRows,
      [{ text: "➕ Nouveau radar", callback_data: "create_radar" }],
      [{ text: "🌐 Dashboard", url: dashboardLoginUrl(String(ctx.from.id)) }]
    ] } });
  }
  bot.command("radars", listRadars);
  bot.action("list_radars", async (ctx) => { await safeAnswerCbQuery(ctx); await listRadars(ctx); });

  async function replyInbox(ctx: any, mode: "home" | "top" | "review" | "saved" | "rejected" = "home") {
    const user = await userFor(ctx);
    if (mode === "home") {
      const [{ count: review }, { count: saved }, { count: rejected }] = await Promise.all([
        serviceDb().from("alerts").select("*", { count: "exact", head: true }).eq("user_id", user.id).in("status", ["created", "inbox", "sent"]),
        serviceDb().from("alerts").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "saved"),
        serviceDb().from("alerts").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "rejected")
      ]);
      await ctx.reply([
        "📥 Inbox Deal Hunter",
        "",
        `⚡ À trier : ${review ?? 0}`,
        `❤️ Gardés : ${saved ?? 0}`,
        `❌ Rejetés : ${rejected ?? 0}`,
        "",
        "Traite les deals comme Tinder : garde ou jette, puis passe au suivant."
      ].join("\n"), {
        reply_markup: { inline_keyboard: [
          [{ text: "⚡ Trier maintenant", callback_data: "deal_next" }],
          [{ text: "🔥 Top deals", callback_data: "inbox:top" }, { text: "🟡 À trier", callback_data: "inbox:review" }],
          [{ text: "❤️ Gardés", callback_data: "inbox:saved" }, { text: "❌ Rejetés", callback_data: "inbox:rejected" }],
          [{ text: "📡 Par radar", callback_data: "list_radars" }, { text: "🌐 Dashboard", url: dashboardLoginUrl(String(ctx.from.id)) }]
        ] }
      });
      return;
    }

    let query = serviceDb()
      .from("alerts")
      .select("id,status,created_at,products(title,source,price_amount,price_currency,product_url,auction_end_at,product_images(image_url,position)),deal_scores(total_score,estimated_net_profit,estimated_roi_percent),radars(name)")
      .eq("user_id", user.id);
    if (mode === "top") query = query.in("status", ["created", "inbox", "sent", "saved", "negotiating"]).order("created_at", { ascending: false }).limit(30);
    if (mode === "review") query = query.in("status", ["created", "inbox", "sent"]).order("created_at", { ascending: false }).limit(8);
    if (mode === "saved") query = query.eq("status", "saved").order("created_at", { ascending: false }).limit(8);
    if (mode === "rejected") query = query.eq("status", "rejected").order("created_at", { ascending: false }).limit(8);
    const { data } = await query;
    const rows = mode === "top"
      ? (data ?? []).sort((a: any, b: any) => {
          const scoreA = Array.isArray(a.deal_scores) ? a.deal_scores[0]?.total_score : a.deal_scores?.total_score;
          const scoreB = Array.isArray(b.deal_scores) ? b.deal_scores[0]?.total_score : b.deal_scores?.total_score;
          return Number(scoreB ?? 0) - Number(scoreA ?? 0);
        }).slice(0, 8)
      : (data ?? []);
    if (!rows.length) {
      await ctx.reply("Aucun deal dans cette catégorie.", {
        reply_markup: { inline_keyboard: [[{ text: "📥 Retour inbox", callback_data: "inbox" }]] }
      });
      return;
    }
    await ctx.reply(`📥 ${mode === "top" ? "Top deals" : mode === "review" ? "À trier" : mode === "saved" ? "Gardés" : "Rejetés"}\n\n${rows.map((alert: any, index: number) => {
      const product = Array.isArray(alert.products) ? alert.products[0] : alert.products;
      const score = Array.isArray(alert.deal_scores) ? alert.deal_scores[0] : alert.deal_scores;
      const radar = Array.isArray(alert.radars) ? alert.radars[0] : alert.radars;
      return `${index + 1}. ${product?.title ?? "Annonce"}\n   ${radar?.name ?? "Radar"} • ${product?.source ?? "source"} • score ${score?.total_score ?? "—"}/100 • ${money(score?.estimated_net_profit)}`;
    }).join("\n\n")}`, {
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [
        [{ text: "⚡ Trier maintenant", callback_data: "deal_next" }],
        [{ text: "📥 Retour inbox", callback_data: "inbox" }]
      ] }
    });
  }

  async function replyNextDeal(ctx: any) {
    const user = await userFor(ctx);
    const { data } = await serviceDb()
      .from("alerts")
      .select("id,status,created_at,products(title,source,price_amount,price_currency,product_url,auction_end_at,product_images(image_url,position)),deal_scores(total_score,estimated_net_profit,estimated_roi_percent)")
      .eq("user_id", user.id)
      .in("status", ["created", "inbox", "sent"])
      .order("created_at", { ascending: false })
      .limit(1);
    if (!data?.length) {
      await ctx.reply("✅ Inbox vide. Aucun deal à trier pour le moment.", {
        reply_markup: { inline_keyboard: [[{ text: "📡 Mes radars", callback_data: "list_radars" }]] }
      });
      return;
    }
    await replyDealCard(ctx, data[0]);
  }

  bot.command("inbox", (ctx) => replyInbox(ctx));
  bot.action("inbox", async (ctx) => { await safeAnswerCbQuery(ctx); await replyInbox(ctx); });
  bot.action(/^inbox:(top|review|saved|rejected)$/, async (ctx) => {
    await safeAnswerCbQuery(ctx);
    await replyInbox(ctx, ctx.match[1] as "top" | "review" | "saved" | "rejected");
  });
  bot.action("deal_next", async (ctx) => { await safeAnswerCbQuery(ctx, "Deal suivant"); await replyNextDeal(ctx); });

  async function replyAlerts(ctx: any) {
    const user = await userFor(ctx);
    const { data } = await serviceDb()
      .from("alerts")
      .select("id,status,created_at,products(title,source,price_amount,price_currency,product_url),deal_scores(total_score,estimated_net_profit)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);
    if (!data?.length) {
      await ctx.reply("Aucune alerte pour le moment. Crée un radar ou lance un scan manuel.", {
        reply_markup: { inline_keyboard: [[{ text: "➕ Créer un radar", callback_data: "create_radar" }]] }
      });
      return;
    }
    await ctx.reply(`🚨 Dernières alertes\n\n${data.map((a: any, index: number) => {
      const product = Array.isArray(a.products) ? a.products[0] : a.products;
      const score = Array.isArray(a.deal_scores) ? a.deal_scores[0] : a.deal_scores;
      return `${index + 1}. ${product?.title ?? "Annonce"}\n   ${product?.source ?? "source"} • ${product?.price_amount ?? "—"} ${product?.price_currency ?? ""} • score ${score?.total_score ?? "—"}/100\n   ${product?.product_url ?? "Lien indisponible"}`;
    }).join("\n\n")}`, { disable_web_page_preview: true });
  }
  bot.command("alerts", replyAlerts);
  bot.action("list_alerts", async (ctx) => { await safeAnswerCbQuery(ctx); await replyAlerts(ctx); });

  async function replyDeals(ctx: any) {
    const user = await userFor(ctx);
    const { data } = await serviceDb()
      .from("deal_scores")
      .select("total_score,recommendation,estimated_net_profit,estimated_roi_percent,products(title,source,price_amount,price_currency,product_url)")
      .eq("user_id", user.id)
      .order("total_score", { ascending: false })
      .limit(5);
    if (!data?.length) {
      await ctx.reply("Aucun deal exploitable pour le moment. Lance un scan depuis « Mes radars ».", {
        reply_markup: { inline_keyboard: [[{ text: "📡 Mes radars", callback_data: "list_radars" }]] }
      });
      return;
    }
    await ctx.reply(`⭐ Meilleurs deals\n\n${data.map((d: any, index: number) => {
      const product = Array.isArray(d.products) ? d.products[0] : d.products;
      return `${index + 1}. ${product?.title ?? "Annonce"}\n   ${product?.source ?? "source"} • score ${d.total_score}/100 • +${Math.round(Number(d.estimated_net_profit ?? 0))} CHF • ROI ${Number(d.estimated_roi_percent ?? 0).toFixed(1)}%\n   ${product?.product_url ?? "Lien indisponible"}`;
    }).join("\n\n")}`, { disable_web_page_preview: true });
  }
  bot.command("deals", replyDeals);
  bot.action("list_deals", async (ctx) => { await safeAnswerCbQuery(ctx); await replyDeals(ctx); });
  bot.command("status", async (ctx) => {
    const user = await userFor(ctx);
    const [{ count: activeRadars }, { count: alertsToday }] = await Promise.all([
      serviceDb().from("radars").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("is_active", true),
      serviceDb().from("alerts").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", new Date(Date.now() - 86_400_000).toISOString())
    ]);
    await ctx.reply([
      "📊 Statut Deal Hunter",
      "",
      `Compte : ${user.status}`,
      `Plan : ${user.plan}`,
      `Alertes : ${user.alerts_enabled ? "activées" : "désactivées"}`,
      `Radars actifs : ${activeRadars ?? 0}`,
      `Alertes 24h : ${alertsToday ?? 0}`
    ].join("\n"), {
      reply_markup: { inline_keyboard: [
        [{ text: "📡 Mes radars", callback_data: "list_radars" }],
        [{ text: "🌐 Dashboard", url: dashboardLoginUrl(String(ctx.from.id)) }]
      ] }
    });
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
      await acceptWizardSearch(ctx, telegramId, payload, ctx.message.text); return;
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
    await safeAnswerCbQuery(ctx,"Scan lancé");
    await scanAndReply(ctx, ctx.match[1], user.id);
  });
  bot.action(/^(save|reject|remind|noremind|negotiate|analysis):(.+)$/, async (ctx) => {
    const rawAction = ctx.match[1];
    const alertId = ctx.match[2];
    if (!isTelegramDealAction(rawAction)) {
      const user = await userFor(ctx);
      await logTelegramEvent("telegram_callback_invalid", user.id, { action: rawAction });
      await safeAnswerCbQuery(ctx,"Action inconnue", { show_alert: true });
      return;
    }
    const action: TelegramDealAction = rawAction;
    try {
      const user = await userFor(ctx);
      const { data: alert, error: alertError } = await serviceDb().from("alerts").select("*").eq("id", alertId).eq("user_id", user.id).maybeSingle();
      if (alertError) throw alertError;
      if (!alert) {
        await safeAnswerCbQuery(ctx,"Alerte introuvable ou non liée à ton compte.", { show_alert: true });
        return;
      }
      if (action === "analysis") {
        await logTelegramEvent("deal_full_analysis_requested", user.id, { alert_id: alertId });
        await replyWithFullAnalysis(ctx, alert);
        return;
      }
      if (action === "noremind") {
        await safeAnswerCbQuery(ctx,"Rappel ignoré");
        await ctx.reply("👌 Aucun rappel créé pour cette annonce.");
        return;
      }
      const { product, score } = await loadDealContext(alert);
      if (action === "save") {
        const { error: saveError } = await serviceDb().from("saved_deals").upsert({ user_id: user.id, product_id: alert.product_id });
        if (saveError) throw saveError;
        await serviceDb().from("rejected_products").delete().eq("user_id", user.id).eq("product_id", alert.product_id);
        await updateAlertStatus(alertId, user.id, "saved");
        await logTelegramEvent("deal_action_saved", user.id, { alert_id: alertId, product_id: alert.product_id });
        await safeAnswerCbQuery(ctx,"Sauvegardé");
        await ctx.reply("✅ Deal sauvegardé. Tu le retrouves dans Gardés.", {
          reply_markup: { inline_keyboard: [[{ text: "➡️ Deal suivant", callback_data: "deal_next" }, { text: "📥 Inbox", callback_data: "inbox" }]] }
        });
        return;
      }
      if (action === "reject") {
        const { error: rejectError } = await serviceDb().from("rejected_products").upsert({ user_id: user.id, product_id: alert.product_id, reason: "Telegram" });
        if (rejectError) throw rejectError;
        await serviceDb().from("saved_deals").delete().eq("user_id", user.id).eq("product_id", alert.product_id);
        await updateAlertStatus(alertId, user.id, "rejected");
        await logTelegramEvent("deal_action_rejected", user.id, { alert_id: alertId, product_id: alert.product_id });
        await safeAnswerCbQuery(ctx,"Rejeté");
        await ctx.reply("❌ Deal rejeté. Lui et ses doublons probables seront évités dans les prochains scans.", {
          reply_markup: { inline_keyboard: [[{ text: "➡️ Deal suivant", callback_data: "deal_next" }, { text: "📥 Inbox", callback_data: "inbox" }]] }
        });
        return;
      }
      if (action === "negotiate") {
        const { error: saveError } = await serviceDb().from("saved_deals").upsert({ user_id: user.id, product_id: alert.product_id });
        if (saveError) throw saveError;
        await serviceDb().from("rejected_products").delete().eq("user_id", user.id).eq("product_id", alert.product_id);
        await updateAlertStatus(alertId, user.id, "negotiating");
        await logTelegramEvent("deal_action_negotiation_requested", user.id, { alert_id: alertId, product_id: alert.product_id });
        await safeAnswerCbQuery(ctx,"Négociation préparée");
        await ctx.reply(negotiationReply(product, score));
        return;
      }
      if (action === "remind") {
        if (!product?.auction_end_at) {
          await safeAnswerCbQuery(ctx,"Pas de date d’enchère détectée.", { show_alert: true });
          await ctx.reply("🔔 Rappel impossible : cette annonce n’a pas de date de fin d’enchère exploitable.");
          return;
        }
        const { error: reminderError } = await serviceDb().from("auction_reminders").upsert({
          user_id: user.id, product_id: alert.product_id, radar_id: alert.radar_id,
          remind_at: new Date(new Date(product.auction_end_at).getTime() - 3_600_000).toISOString(), status: "pending"
        });
        if (reminderError) throw reminderError;
        await updateAlertStatus(alertId, user.id, alertStatusForTelegramAction(action) ?? "reminder");
        await safeAnswerCbQuery(ctx,"Rappel créé");
        await ctx.reply("🔔 Rappel créé 1h avant la fin de l’enchère.");
      }
    } catch (error) {
      console.error("Action bouton Telegram impossible:", error instanceof Error ? error.message : error);
      await safeAnswerCbQuery(ctx,"Action impossible", { show_alert: true });
      await ctx.reply("⚠️ Action impossible pour le moment. Réessaie ou ouvre le Dashboard pour vérifier ce deal.");
    }
  });
  return bot;
}
