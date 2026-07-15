import { serviceDb } from "@/lib/db/server";
import { sendTelegramText, type TelegramFailureReason } from "@/telegram/send-alert";

export type BroadcastAudience = "all_started" | "active_free" | "active_paid";
export type BroadcastDeliveryStatus = "sent" | "failed" | "blocked" | "skipped";

type LocalizedContent = Partial<Record<"fr" | "en" | "de" | "it", string>>;

type BroadcastPayload = {
  broadcast_id: string;
  slug?: string;
  title: string;
  content_html: string;
  content_by_locale?: LocalizedContent;
  audience: BroadcastAudience;
  button_label?: string | null;
  button_url?: string | null;
};

export type BroadcastSummary = BroadcastPayload & {
  created_at: string;
  preview_sent_at: string | null;
  approved_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  sent_count: number;
  failed_count: number;
  blocked_count: number;
  skipped_count: number;
  target_count: number;
  status: "draft" | "preview_sent" | "approved" | "sending" | "completed" | "partial";
};

const EVENT_PREFIX = "telegram.broadcast.";
const RELEASE_BROADCAST_ID = "release-query-intelligence-2026-07";
const RELEASE_SLUG = "query-intelligence-2026-07";

const RELEASE_CONTENT: Record<"fr" | "en" | "de" | "it", string> = {
  fr: [
    "🚀 <b>DEAL HUNTER AI — NOUVELLE VERSION</b> 🚀",
    "",
    "✨ Le moteur de recherche des radars vient d’être amélioré.",
    "",
    "🧠 <b>Recherche plus intelligente</b>",
    "🔎 Le bot comprend mieux les recherches comme <b>« lunettes mascotte »</b>.",
    "🌍 Il teste plusieurs formulations réellement utilisées par les vendeurs, notamment en français, anglais, allemand, italien et selon le produit.",
    "🎯 Il filtre davantage les annonces hors sujet.",
    "",
    "🛍️ <b>Sources améliorées</b>",
    "eBay, Ricardo, Anibis, Tutti et Komehyo utilisent maintenant ce moteur de requêtes plus précis.",
    "",
    "📱 <b>Telegram plus agréable</b>",
    "Les écrans sont plus courts, les actions restent accessibles et la navigation empile moins de messages.",
    "",
    "⚠️ <b>En toute transparence</b>",
    "Cette amélioration augmente la couverture et la pertinence des recherches, mais elle ne garantit pas qu’un deal apparaîtra si aucune annonce ne respecte réellement le budget, la marge, le score ou les autres critères du radar.",
    "",
    "🧪 <b>À faire maintenant</b>",
    "Relance simplement tes radars existants pour profiter de la nouvelle recherche.",
    "",
    "💙 Merci de participer à la bêta privée et de nous aider à améliorer Deal Hunter AI."
  ].join("\n"),
  en: [
    "🚀 <b>DEAL HUNTER AI — NEW VERSION</b> 🚀",
    "",
    "✨ The radar search engine has been improved.",
    "",
    "🧠 <b>Smarter search</b>",
    "🔎 The bot now understands niche searches more accurately.",
    "🌍 It tries several seller-style formulations in multiple languages, depending on the product.",
    "🎯 It filters more unrelated listings.",
    "",
    "🛍️ <b>Improved sources</b>",
    "eBay, Ricardo, Anibis, Tutti and Komehyo now use the more precise query engine.",
    "",
    "📱 <b>A smoother Telegram experience</b>",
    "Screens are shorter, actions remain accessible and fewer messages are stacked.",
    "",
    "⚠️ <b>Transparent note</b>",
    "This improves search coverage and relevance, but it cannot guarantee a deal when no listing actually meets the radar’s budget, profit, score or other criteria.",
    "",
    "🧪 Relaunch your existing radars to use the new search.",
    "",
    "💙 Thank you for helping us improve the private beta."
  ].join("\n"),
  de: [
    "🚀 <b>DEAL HUNTER AI — NEUE VERSION</b> 🚀",
    "",
    "✨ Die Suchmaschine der Radare wurde verbessert.",
    "",
    "🧠 <b>Intelligentere Suche</b>",
    "🔎 Der Bot versteht nun auch spezielle Suchanfragen besser.",
    "🌍 Je nach Produkt werden mehrere typische Verkäuferbegriffe und Sprachen verwendet.",
    "🎯 Unpassende Anzeigen werden stärker herausgefiltert.",
    "",
    "🛍️ <b>Verbesserte Quellen</b>",
    "eBay, Ricardo, Anibis, Tutti und Komehyo verwenden jetzt die präzisere Suchlogik.",
    "",
    "📱 <b>Telegram ist übersichtlicher</b>",
    "Kürzere Ansichten, erreichbare Aktionen und weniger übereinander gestapelte Nachrichten.",
    "",
    "⚠️ <b>Transparent erklärt</b>",
    "Die Verbesserung erhöht Reichweite und Relevanz, garantiert aber keinen Deal, wenn keine Anzeige Budget, Gewinn, Score oder andere Radar-Kriterien erfüllt.",
    "",
    "🧪 Starte deine bestehenden Radare erneut, um die neue Suche zu testen.",
    "",
    "💙 Danke für deine Hilfe bei der privaten Beta."
  ].join("\n"),
  it: [
    "🚀 <b>DEAL HUNTER AI — NUOVA VERSIONE</b> 🚀",
    "",
    "✨ Il motore di ricerca dei radar è stato migliorato.",
    "",
    "🧠 <b>Ricerca più intelligente</b>",
    "🔎 Il bot comprende meglio anche le ricerche di nicchia.",
    "🌍 Prova più formulazioni realmente usate dai venditori e più lingue, secondo il prodotto.",
    "🎯 Filtra meglio gli annunci non pertinenti.",
    "",
    "🛍️ <b>Fonti migliorate</b>",
    "eBay, Ricardo, Anibis, Tutti e Komehyo usano ora il motore di ricerca più preciso.",
    "",
    "📱 <b>Telegram più semplice</b>",
    "Schermate più brevi, azioni sempre disponibili e meno messaggi accumulati.",
    "",
    "⚠️ <b>Con trasparenza</b>",
    "Questo aumenta copertura e pertinenza, ma non garantisce un deal se nessun annuncio rispetta davvero budget, margine, punteggio o gli altri criteri del radar.",
    "",
    "🧪 Riavvia i radar esistenti per usare la nuova ricerca.",
    "",
    "💙 Grazie per contribuire alla beta privata."
  ].join("\n")
};

function broadcastKeyboard(buttonLabel?: string | null, buttonUrl?: string | null) {
  const rows: Array<Array<Record<string, string>>> = [
    [
      { text: "🔎 Mes radars", callback_data: "list_radars" },
      { text: "📥 Inbox", callback_data: "inbox" }
    ],
    [{ text: "🧭 Menu", callback_data: "menu" }]
  ];
  if (buttonLabel && buttonUrl) rows.unshift([{ text: buttonLabel, url: buttonUrl }]);
  return { inline_keyboard: rows };
}

function normalizeLocale(value: unknown): "fr" | "en" | "de" | "it" {
  const locale = String(value ?? "fr").toLowerCase().slice(0, 2);
  return locale === "en" || locale === "de" || locale === "it" ? locale : "fr";
}

function contentFor(payload: BroadcastPayload, locale: unknown) {
  const language = normalizeLocale(locale);
  return payload.content_by_locale?.[language] ?? payload.content_html;
}

function deliveryStatus(reason?: TelegramFailureReason): BroadcastDeliveryStatus {
  if (!reason) return "sent";
  if (reason === "telegram_forbidden") return "blocked";
  if (reason === "telegram_token_missing") return "skipped";
  return "failed";
}

async function insertEvent(actorUserId: string | null, action: string, payload: Record<string, unknown>) {
  const { error } = await serviceDb().from("admin_logs").insert({
    actor_user_id: actorUserId,
    action: `${EVENT_PREFIX}${action}`,
    payload
  });
  if (error) throw error;
}

async function createdEvent(broadcastId: string) {
  const { data, error } = await serviceDb()
    .from("admin_logs")
    .select("id,actor_user_id,action,payload,created_at")
    .eq("action", `${EVENT_PREFIX}created`)
    .contains("payload", { broadcast_id: broadcastId })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as any;
}

export async function createBroadcast(input: {
  actorUserId: string;
  title: string;
  contentHtml: string;
  audience: BroadcastAudience;
  buttonLabel?: string | null;
  buttonUrl?: string | null;
  broadcastId?: string;
  slug?: string;
  contentByLocale?: LocalizedContent;
}) {
  const broadcastId = input.broadcastId ?? crypto.randomUUID();
  const payload: BroadcastPayload = {
    broadcast_id: broadcastId,
    slug: input.slug,
    title: input.title.trim(),
    content_html: input.contentHtml.trim(),
    content_by_locale: input.contentByLocale,
    audience: input.audience,
    button_label: input.buttonLabel?.trim() || null,
    button_url: input.buttonUrl?.trim() || null
  };
  await insertEvent(input.actorUserId, "created", payload);
  return payload;
}

export async function ensureReleaseBroadcast(actorUserId: string) {
  const existing = await createdEvent(RELEASE_BROADCAST_ID);
  if (existing?.payload) return existing.payload as BroadcastPayload;
  return createBroadcast({
    actorUserId,
    broadcastId: RELEASE_BROADCAST_ID,
    slug: RELEASE_SLUG,
    title: "Deal Hunter AI — recherche intelligente multilingue",
    contentHtml: RELEASE_CONTENT.fr,
    contentByLocale: RELEASE_CONTENT,
    audience: "all_started"
  });
}

export async function getBroadcastPayload(broadcastId: string): Promise<BroadcastPayload | null> {
  const event = await createdEvent(broadcastId);
  return event?.payload ? event.payload as BroadcastPayload : null;
}

export async function sendBroadcastPreview(broadcastId: string, actorUserId: string) {
  const payload = await getBroadcastPayload(broadcastId);
  if (!payload) throw new Error("Diffusion introuvable.");
  const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;
  if (!adminTelegramId) throw new Error("ADMIN_TELEGRAM_ID manquant.");
  const { data: admin, error } = await serviceDb()
    .from("users")
    .select("id,telegram_id,preferred_language,display_name")
    .eq("telegram_id", adminTelegramId)
    .maybeSingle();
  if (error) throw error;
  if (!admin?.telegram_id) throw new Error("Compte Telegram administrateur introuvable.");

  const result = await sendTelegramText(admin.telegram_id, contentFor(payload, admin.preferred_language), {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: broadcastKeyboard(payload.button_label, payload.button_url)
  });
  const status = deliveryStatus(result.reason);
  await insertEvent(actorUserId, "delivery", {
    broadcast_id: broadcastId,
    target_user_id: admin.id,
    telegram_id: admin.telegram_id,
    scope: "preview",
    status,
    reason: result.reason ?? null,
    telegram_message_id: result.messageId
  });
  if (result.skipped) throw new Error(`Aperçu non envoyé : ${result.reason}`);
  await insertEvent(actorUserId, "preview_sent", { broadcast_id: broadcastId });
  return { messageId: result.messageId, recipient: admin.display_name ?? "Administrateur" };
}

async function blockedTelegramIds() {
  const { data, error } = await serviceDb()
    .from("admin_logs")
    .select("payload")
    .eq("action", `${EVENT_PREFIX}delivery`)
    .contains("payload", { status: "blocked" })
    .limit(5000);
  if (error) throw error;
  return new Set((data ?? []).map((row: any) => String(row.payload?.telegram_id ?? "")).filter(Boolean));
}

async function deliveredTelegramIds(broadcastId: string) {
  const { data, error } = await serviceDb()
    .from("admin_logs")
    .select("payload")
    .eq("action", `${EVENT_PREFIX}delivery`)
    .contains("payload", { broadcast_id: broadcastId })
    .limit(10000);
  if (error) throw error;
  return new Set((data ?? [])
    .filter((row: any) => ["sent", "blocked", "skipped"].includes(String(row.payload?.status)))
    .map((row: any) => String(row.payload?.telegram_id ?? ""))
    .filter(Boolean));
}

async function recipientsFor(payload: BroadcastPayload) {
  let query = serviceDb()
    .from("users")
    .select("id,telegram_id,preferred_language,display_name,plan,status")
    .not("telegram_id", "is", null)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(10000);
  if (payload.audience === "active_free") query = query.eq("plan", "free");
  if (payload.audience === "active_paid") query = query.in("plan", ["pro", "business"]);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function dispatchBroadcastBatch(broadcastId: string, actorUserId: string, batchSize = 25) {
  const payload = await getBroadcastPayload(broadcastId);
  if (!payload) throw new Error("Diffusion introuvable.");
  const [recipients, blocked, delivered] = await Promise.all([
    recipientsFor(payload),
    blockedTelegramIds(),
    deliveredTelegramIds(broadcastId)
  ]);
  const eligible = recipients.filter((recipient: any) => {
    const telegramId = String(recipient.telegram_id ?? "");
    return telegramId && !blocked.has(telegramId) && !delivered.has(telegramId);
  });
  const batch = eligible.slice(0, Math.max(1, Math.min(batchSize, 50)));

  if (batch.length) await insertEvent(actorUserId, "started", { broadcast_id: broadcastId, batch_size: batch.length });
  const events: Array<{ actor_user_id: string; action: string; payload: Record<string, unknown> }> = [];
  for (const recipient of batch as any[]) {
    const telegramId = String(recipient.telegram_id);
    const result = await sendTelegramText(telegramId, contentFor(payload, recipient.preferred_language), {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: broadcastKeyboard(payload.button_label, payload.button_url)
    });
    const status = deliveryStatus(result.reason);
    events.push({
      actor_user_id: actorUserId,
      action: `${EVENT_PREFIX}delivery`,
      payload: {
        broadcast_id: broadcastId,
        target_user_id: recipient.id,
        telegram_id: telegramId,
        scope: "broadcast",
        status,
        reason: result.reason ?? null,
        telegram_message_id: result.messageId
      }
    });
    await pause(45);
  }
  if (events.length) {
    const { error } = await serviceDb().from("admin_logs").insert(events);
    if (error) throw error;
  }

  const hasMore = eligible.length > batch.length;
  if (!hasMore) await insertEvent(actorUserId, "completed", { broadcast_id: broadcastId });
  return { processed: batch.length, remaining: Math.max(0, eligible.length - batch.length), hasMore };
}

export async function approveBroadcast(broadcastId: string, actorUserId: string) {
  const payload = await getBroadcastPayload(broadcastId);
  if (!payload) throw new Error("Diffusion introuvable.");
  await insertEvent(actorUserId, "approved", { broadcast_id: broadcastId });
}

export async function listBroadcasts(): Promise<BroadcastSummary[]> {
  const { data, error } = await serviceDb()
    .from("admin_logs")
    .select("action,payload,created_at")
    .like("action", `${EVENT_PREFIX}%`)
    .order("created_at", { ascending: true })
    .limit(10000);
  if (error) throw error;

  const campaigns = new Map<string, BroadcastSummary>();
  for (const row of data ?? []) {
    const payload = (row as any).payload ?? {};
    const id = String(payload.broadcast_id ?? "");
    if (!id) continue;
    if ((row as any).action === `${EVENT_PREFIX}created`) {
      campaigns.set(id, {
        ...(payload as BroadcastPayload),
        created_at: (row as any).created_at,
        preview_sent_at: null,
        approved_at: null,
        started_at: null,
        completed_at: null,
        sent_count: 0,
        failed_count: 0,
        blocked_count: 0,
        skipped_count: 0,
        target_count: 0,
        status: "draft"
      });
      continue;
    }
    const campaign = campaigns.get(id);
    if (!campaign) continue;
    const action = String((row as any).action);
    if (action.endsWith("preview_sent")) campaign.preview_sent_at = (row as any).created_at;
    if (action.endsWith("approved")) campaign.approved_at = (row as any).created_at;
    if (action.endsWith("started")) campaign.started_at = campaign.started_at ?? (row as any).created_at;
    if (action.endsWith("completed")) campaign.completed_at = (row as any).created_at;
    if (action.endsWith("delivery") && payload.scope === "broadcast") {
      if (payload.status === "sent") campaign.sent_count += 1;
      if (payload.status === "failed") campaign.failed_count += 1;
      if (payload.status === "blocked") campaign.blocked_count += 1;
      if (payload.status === "skipped") campaign.skipped_count += 1;
    }
  }

  const recipientCounts = new Map<BroadcastAudience, number>();
  for (const audience of ["all_started", "active_free", "active_paid"] as BroadcastAudience[]) {
    const payload: BroadcastPayload = { broadcast_id: "count", title: "", content_html: "", audience };
    recipientCounts.set(audience, (await recipientsFor(payload)).length);
  }

  for (const campaign of campaigns.values()) {
    campaign.target_count = recipientCounts.get(campaign.audience) ?? 0;
    if (campaign.completed_at) campaign.status = campaign.failed_count || campaign.blocked_count ? "partial" : "completed";
    else if (campaign.started_at) campaign.status = "sending";
    else if (campaign.approved_at) campaign.status = "approved";
    else if (campaign.preview_sent_at) campaign.status = "preview_sent";
  }
  return [...campaigns.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function releaseBroadcastId() {
  return RELEASE_BROADCAST_ID;
}
