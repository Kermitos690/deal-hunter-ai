import { serviceDb } from "@/lib/db/server";
import { runRadarScan } from "@/lib/scans/run-radar-scan";
import { logTelegramEvent } from "@/telegram/observability";

export const ADMIN_REFILL_CALLBACK = "admin_refill_inbox";
const MAX_ACTIVE_RADARS = 8;
const SCAN_CONCURRENCY = 2;

type RefillRequest = {
  telegramId: string;
  chatId: string;
  callbackQueryId: string | null;
};

type RadarRefillResult = {
  id: string;
  name: string;
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  candidatesFound?: number;
  alertsCreated?: number;
  alertsSent?: number;
  rejectionSummary?: Record<string, number>;
  error?: string;
};

export type AdminInboxRefillSummary = {
  requestedRadars: number;
  completedRadars: number;
  skippedRadars: number;
  failedRadars: number;
  candidatesFound: number;
  alertsCreated: number;
  filteredCandidates: number;
  inboxCount: number;
  topRejectionReasons: Array<{ reason: string; count: number }>;
};

function telegramRequestInfo(update: unknown): RefillRequest | null {
  const value = update as {
    callback_query?: {
      id?: string;
      data?: string;
      from?: { id?: number };
      message?: { chat?: { id?: number } };
    };
    message?: {
      text?: string;
      from?: { id?: number };
      chat?: { id?: number };
    };
  };

  const callback = value.callback_query;
  if (callback?.data === ADMIN_REFILL_CALLBACK && callback.from?.id && callback.message?.chat?.id) {
    return {
      telegramId: String(callback.from.id),
      chatId: String(callback.message.chat.id),
      callbackQueryId: callback.id ?? null
    };
  }

  const text = value.message?.text?.trim() ?? "";
  const isCommand = /^\/refill(?:@\w+)?$/i.test(text) || /^\/start\s+admin_refill_inbox$/i.test(text);
  if (isCommand && value.message?.from?.id && value.message?.chat?.id) {
    return {
      telegramId: String(value.message.from.id),
      chatId: String(value.message.chat.id),
      callbackQueryId: null
    };
  }

  return null;
}

export function isAdminInboxRefillUpdate(update: unknown) {
  return telegramRequestInfo(update) !== null;
}

async function telegramApi(method: string, payload: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN manquant.");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Telegram ${method} a échoué avec HTTP ${response.status}.`);
  return response.json();
}

async function answerCallbackQuery(callbackQueryId: string | null, text: string, showAlert = false) {
  if (!callbackQueryId) return;
  await telegramApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert
  });
}

async function sendMessage(chatId: string, text: string, replyMarkup?: Record<string, unknown>) {
  await telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {})
  });
}

export async function acknowledgeAdminInboxRefill(update: unknown) {
  const request = telegramRequestInfo(update);
  if (!request) return null;

  if (!process.env.ADMIN_TELEGRAM_ID || request.telegramId !== process.env.ADMIN_TELEGRAM_ID) {
    await answerCallbackQuery(request.callbackQueryId, "Action réservée à l’administrateur.", true);
    if (!request.callbackQueryId) await sendMessage(request.chatId, "⛔ Action réservée à l’administrateur.");
    return { ...request, authorized: false as const };
  }

  await answerCallbackQuery(request.callbackQueryId, "Remplissage de l’Inbox lancé");
  await sendMessage(
    request.chatId,
    "⏳ Je lance tes radars actifs en arrière-plan. Les annonces déjà vues ou rejetées resteront exclues. Je t’envoie le bilan dès que c’est terminé."
  );
  return { ...request, authorized: true as const };
}

async function runWithConcurrency<T, R>(items: T[], concurrency: number, task: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function mergeRejectionReasons(results: RadarRefillResult[]) {
  const merged: Record<string, number> = {};
  for (const result of results) {
    for (const [reason, count] of Object.entries(result.rejectionSummary ?? {})) {
      merged[reason] = (merged[reason] ?? 0) + count;
    }
  }
  return Object.entries(merged)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
}

export function summarizeAdminInboxRefill(results: RadarRefillResult[], inboxCount: number): AdminInboxRefillSummary {
  const candidatesFound = results.reduce((sum, result) => sum + Number(result.candidatesFound ?? 0), 0);
  const alertsCreated = results.reduce((sum, result) => sum + Number(result.alertsCreated ?? 0), 0);
  return {
    requestedRadars: results.length,
    completedRadars: results.filter((result) => result.ok && !result.skipped).length,
    skippedRadars: results.filter((result) => result.skipped).length,
    failedRadars: results.filter((result) => !result.ok).length,
    candidatesFound,
    alertsCreated,
    filteredCandidates: Math.max(0, candidatesFound - alertsCreated),
    inboxCount,
    topRejectionReasons: mergeRejectionReasons(results)
  };
}

function readableReason(reason: string) {
  const labels: Record<string, string> = {
    already_seen: "déjà vues",
    rejected_by_user: "déjà rejetées",
    below_min_score: "score insuffisant",
    below_min_profit: "marge insuffisante",
    above_max_buy_price: "prix trop élevé",
    daily_alert_limit_reached: "limite quotidienne",
    currency_conversion_failed: "conversion monétaire"
  };
  return labels[reason] ?? reason.replaceAll("_", " ");
}

export function formatAdminInboxRefillSummary(summary: AdminInboxRefillSummary) {
  const reasons = summary.topRejectionReasons.length
    ? `\n\nPrincipaux filtres :\n${summary.topRejectionReasons.map((item) => `• ${readableReason(item.reason)} : ${item.count}`).join("\n")}`
    : "";
  const outcome = summary.alertsCreated > 0
    ? `✅ ${summary.alertsCreated} nouveau(x) deal(s) unique(s) ajouté(s).`
    : "✅ Aucun nouveau deal unique cette fois-ci. L’anti-doublon a été respecté.";

  return [
    "📥 Remplissage de l’Inbox terminé",
    "",
    outcome,
    `📡 Radars demandés : ${summary.requestedRadars}`,
    `✅ Radars terminés : ${summary.completedRadars}`,
    `⏭ Ignorés/verrouillés : ${summary.skippedRadars}`,
    `⚠️ Erreurs : ${summary.failedRadars}`,
    `🔎 Candidats récupérés : ${summary.candidatesFound}`,
    `🧹 Écartés par filtres ou anti-doublon : ${summary.filteredCandidates}`,
    `🟡 Deals actuellement à trier : ${summary.inboxCount}${reasons}`
  ].join("\n");
}

export async function runAdminInboxRefill(request: RefillRequest) {
  try {
    const db = serviceDb();
    const { data: user, error: userError } = await db
      .from("users")
      .select("id,telegram_id,role,status")
      .eq("telegram_id", request.telegramId)
      .maybeSingle();
    if (userError || !user || user.role !== "admin" || user.status !== "active") {
      throw new Error("Compte administrateur actif introuvable.");
    }

    const { data: radars, error: radarError } = await db
      .from("radars")
      .select("id,name,last_scanned_at")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("last_scanned_at", { ascending: true, nullsFirst: true })
      .limit(MAX_ACTIVE_RADARS);
    if (radarError) throw radarError;

    if (!radars?.length) {
      await sendMessage(request.chatId, "Aucun radar actif. Crée ou réactive un radar avant de remplir l’Inbox.", {
        inline_keyboard: [[{ text: "➕ Créer un radar", callback_data: "create_radar" }]]
      });
      return;
    }

    const startedAt = new Date().toISOString();
    await logTelegramEvent("admin_inbox_refill_started", user.id, { radar_count: radars.length });

    const results = await runWithConcurrency(radars, SCAN_CONCURRENCY, async (radar): Promise<RadarRefillResult> => {
      try {
        const result = await runRadarScan(radar.id, user.id, { updateRadarSchedule: false });
        return { id: radar.id, name: radar.name, ok: true, ...result };
      } catch (error) {
        return {
          id: radar.id,
          name: radar.name,
          ok: false,
          error: error instanceof Error ? error.message : "Erreur inconnue"
        };
      }
    });

    const { error: inboxUpdateError } = await db
      .from("alerts")
      .update({ status: "inbox" })
      .eq("user_id", user.id)
      .gte("created_at", startedAt)
      .in("status", ["created", "sent"]);
    if (inboxUpdateError) console.warn("Normalisation Inbox impossible:", inboxUpdateError.message);

    const { count: inboxCount } = await db
      .from("alerts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("status", ["created", "inbox", "sent"]);

    const summary = summarizeAdminInboxRefill(results, inboxCount ?? 0);
    await logTelegramEvent("admin_inbox_refill_completed", user.id, {
      radar_count: summary.requestedRadars,
      candidates_found: summary.candidatesFound,
      alerts_created: summary.alertsCreated,
      errors: summary.failedRadars
    });
    await sendMessage(request.chatId, formatAdminInboxRefillSummary(summary), {
      inline_keyboard: [
        [{ text: "⚡ Trier maintenant", callback_data: "deal_next" }],
        [{ text: "📥 Voir l’Inbox", callback_data: "inbox" }, { text: "📡 Mes radars", callback_data: "list_radars" }]
      ]
    });
  } catch (error) {
    console.error("Remplissage administrateur de l’Inbox impossible:", error);
    await sendMessage(
      request.chatId,
      `⚠️ Le remplissage de l’Inbox a échoué. ${error instanceof Error ? error.message : "Erreur inconnue"}`,
      { inline_keyboard: [[{ text: "📡 Mes radars", callback_data: "list_radars" }]] }
    );
  }
}
