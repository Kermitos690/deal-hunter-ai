import { serviceDb } from "@/lib/db/server";
import { sendTelegramText, type TelegramFailureReason } from "@/telegram/send-alert";

export type BroadcastAudience = "all_started" | "active_free" | "active_paid";
export type BroadcastDeliveryStatus = "sent" | "failed" | "blocked" | "skipped";

type SupportedLocale = "fr" | "en" | "de" | "it";
type LocalizedContent = Partial<Record<SupportedLocale, string>>;

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

const RELEASE_CONTENT: Record<SupportedLocale, string> = {
  fr: [
    "⚡ <b>DEAL HUNTER AI PASSE AU NIVEAU SUPÉRIEUR</b>",
    "",
    "Tes radars recherchent maintenant plus largement, mais trient plus sévèrement.",
    "",
    "<b>Ce qui change concrètement</b>",
    "🧠 Compréhension des recherches très précises et des surnoms produit.",
    "🌍 Variantes vendeurs en français, anglais, allemand, italien et japonais selon la source.",
    "🛍️ Moteur unifié sur eBay, Ricardo, Anibis, Tutti et Komehyo.",
    "🎯 Davantage d’annonces analysées, moins de résultats hors sujet.",
    "📱 Navigation Telegram plus courte, sans empiler inutilement les messages.",
    "",
    "<b>Notre différence</b>",
    "Un résultat n’est pas présenté comme une bonne affaire uniquement parce qu’il est bon marché : budget, marge, preuves de ventes, pertinence et risque restent contrôlés.",
    "",
    "⚠️ <b>Transparence</b>",
    "Aucun deal ne sera inventé si le marché ne propose rien d’assez solide. Mieux vaut zéro alerte qu’une fausse opportunité.",
    "",
    "👇 <b>Action recommandée</b>",
    "Ouvre tes radars et relance ceux que tu veux tester avec le nouveau moteur."
  ].join("\n"),
  en: [
    "⚡ <b>DEAL HUNTER AI JUST LEVELLED UP</b>",
    "",
    "Your radars now search more broadly while filtering more strictly.",
    "",
    "<b>What changes</b>",
    "🧠 Better understanding of precise searches and product nicknames.",
    "🌍 Seller wording in English, French, German, Italian and Japanese depending on the source.",
    "🛍️ One query engine across eBay, Ricardo, Anibis, Tutti and Komehyo.",
    "🎯 More listings analysed, fewer irrelevant results.",
    "📱 Shorter Telegram screens without unnecessary message stacking.",
    "",
    "<b>Our edge</b>",
    "A cheap listing is not automatically labelled a deal: budget, profit, sold evidence, relevance and risk are still checked.",
    "",
    "⚠️ <b>Transparency</b>",
    "No deal will be invented when the market has nothing solid enough. Zero alerts is better than a false opportunity.",
    "",
    "👇 <b>Recommended action</b>",
    "Open your radars and relaunch the ones you want to test with the new engine."
  ].join("\n"),
  de: [
    "⚡ <b>DEAL HUNTER AI ERREICHT DIE NÄCHSTE STUFE</b>",
    "",
    "Deine Radare suchen jetzt breiter und filtern gleichzeitig strenger.",
    "",
    "<b>Was sich konkret ändert</b>",
    "🧠 Besseres Verständnis präziser Suchanfragen und Produkt-Spitznamen.",
    "🌍 Typische Verkäuferbegriffe auf Deutsch, Englisch, Französisch, Italienisch und Japanisch je nach Quelle.",
    "🛍️ Einheitlicher Suchmotor für eBay, Ricardo, Anibis, Tutti und Komehyo.",
    "🎯 Mehr analysierte Anzeigen, weniger unpassende Ergebnisse.",
    "📱 Kürzere Telegram-Ansichten ohne unnötig gestapelte Nachrichten.",
    "",
    "<b>Unser Vorteil</b>",
    "Eine günstige Anzeige gilt nicht automatisch als Deal: Budget, Gewinn, Verkaufsnachweise, Relevanz und Risiko werden weiterhin geprüft.",
    "",
    "⚠️ <b>Transparenz</b>",
    "Wenn der Markt nichts Solides bietet, wird kein Deal erfunden. Keine Meldung ist besser als eine falsche Gelegenheit.",
    "",
    "👇 <b>Empfohlene Aktion</b>",
    "Öffne deine Radare und starte die gewünschten Suchen mit dem neuen Motor neu."
  ].join("\n"),
  it: [
    "⚡ <b>DEAL HUNTER AI SALE DI LIVELLO</b>",
    "",
    "I tuoi radar cercano ora più ampiamente, ma filtrano in modo più severo.",
    "",
    "<b>Cosa cambia concretamente</b>",
    "🧠 Migliore comprensione delle ricerche precise e dei soprannomi dei prodotti.",
    "🌍 Formulazioni reali dei venditori in italiano, inglese, francese, tedesco e giapponese secondo la fonte.",
    "🛍️ Un unico motore per eBay, Ricardo, Anibis, Tutti e Komehyo.",
    "🎯 Più annunci analizzati, meno risultati fuori tema.",
    "📱 Schermate Telegram più brevi senza accumulare messaggi inutili.",
    "",
    "<b>Il nostro vantaggio</b>",
    "Un annuncio economico non viene definito automaticamente un affare: budget, margine, vendite concluse, pertinenza e rischio restano verificati.",
    "",
    "⚠️ <b>Trasparenza</b>",
    "Nessun deal viene inventato quando il mercato non offre nulla di abbastanza solido. Meglio zero avvisi che una falsa opportunità.",
    "",
    "👇 <b>Azione consigliata</b>",
    "Apri i tuoi radar e rilancia quelli che vuoi testare con il nuovo motore."
  ].join("\n")
};

const KEYBOARD_LABELS: Record<SupportedLocale, { radars: string; inbox: string; menu: string }> = {
  fr: { radars: "⚡ Tester mes radars", inbox: "📥 Voir l’Inbox", menu: "🧭 Menu principal" },
  en: { radars: "⚡ Test my radars", inbox: "📥 Open Inbox", menu: "🧭 Main menu" },
  de: { radars: "⚡ Radare testen", inbox: "📥 Inbox öffnen", menu: "🧭 Hauptmenü" },
  it: { radars: "⚡ Prova i radar", inbox: "📥 Apri Inbox", menu: "🧭 Menu principale" }
};

function normalizeLocale(value: unknown): SupportedLocale {
  const locale = String(value ?? "fr").toLowerCase().slice(0, 2);
  return locale === "en" || locale === "de" || locale === "it" ? locale : "fr";
}

function broadcastKeyboard(locale: unknown, buttonLabel?: string | null, buttonUrl?: string | null) {
  const labels = KEYBOARD_LABELS[normalizeLocale(locale)];
  const rows: Array<Array<Record<string, string>>> = [
    [{ text: labels.radars, callback_data: "list_radars" }],
    [
      { text: labels.inbox, callback_data: "inbox" },
      { text: labels.menu, callback_data: "menu" }
    ]
  ];
  if (buttonLabel && buttonUrl) rows.unshift([{ text: buttonLabel, url: buttonUrl }]);
  return { inline_keyboard: rows };
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
    reply_markup: broadcastKeyboard(admin.preferred_language, payload.button_label, payload.button_url)
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
    .filter((row: any) => ["sent", "failed", "blocked", "skipped"].includes(String(row.payload?.status)))
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
      reply_markup: broadcastKeyboard(recipient.preferred_language, payload.button_label, payload.button_url)
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
