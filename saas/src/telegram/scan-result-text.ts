const SCAN_RESULT_FORMAT_VERSION = "scan-v5";

const REJECTION_LABELS: Record<string, string> = {
  price_above_max: "prix au-dessus du max",
  landed_cost_above_budget: "coût livré au-dessus du budget",
  missing_photos: "photos manquantes",
  condition_not_accepted: "état non accepté",
  brand_not_matched: "marque non trouvée",
  model_not_matched: "modèle non trouvé",
  keyword_not_matched: "mot-clé requis absent",
  excluded_keyword: "mot-clé exclu",
  country_not_accepted: "pays non accepté",
  sale_type_not_accepted: "type de vente refusé",
  score_too_low: "score trop bas",
  profit_too_low: "profit trop bas",
  negative_profit: "profit négatif",
  roi_too_low: "ROI trop bas",
  already_seen: "déjà vu",
  rejected_by_user: "déjà rejeté",
  daily_alert_limit_reached: "limite journalière atteinte",
  currency_conversion_failed: "conversion CHF impossible"
};

function rejectionSummaryText(summary?: Record<string, number>) {
  const entries = Object.entries(summary ?? {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (!entries.length) return "";
  return `\n\n🔍 Filtres bloquants principaux\n${entries.map(([reason, count]) => `• ${REJECTION_LABELS[reason] ?? reason} : ${count}`).join("\n")}`;
}

function sourceErrorsText(errors?: string[]) {
  const entries = (errors ?? []).filter(Boolean).slice(0, 5);
  if (!entries.length) return "";
  return `\n\nSources à vérifier\nCertaines sources sont temporairement instables. Le radar continue avec les autres sources disponibles.\n${entries.map((error) => `• ${error}`).join("\n")}`;
}

export function scanResultText(result: {
  candidatesFound: number;
  alertsSent: number;
  alertsCreated?: number;
  telegramSkipped?: number;
  rejectionSummary?: Record<string, number>;
  skipped?: boolean;
  reason?: string;
  sourceErrors?: string[];
}) {
  if (result.skipped && result.reason === "all_sources_failed") {
    return `⚠️ Scan terminé sans résultat exploitable.

Toutes les sources choisies sont temporairement indisponibles ou bloquées.${sourceErrorsText(result.sourceErrors)}

Action conseillée : relance le radar avec eBay mondial ou « Toutes sources globales », puis resserre les filtres si tu reçois trop de résultats.

_scan-v5_`;
  }
  if (result.skipped) {
    const reason = result.reason === "radar_locked"
      ? "un scan est déjà en cours"
      : result.reason === "user_suspended"
        ? "le compte est suspendu"
        : "aucune source active n’est disponible";
    return `⏭️ Scan non lancé : ${reason}.`;
  }
  const alertsCreated = result.alertsCreated ?? result.alertsSent;
  const telegramSkipped = result.telegramSkipped ?? Math.max(0, alertsCreated - result.alertsSent);
  const selectedRate = result.candidatesFound > 0
    ? ((alertsCreated / result.candidatesFound) * 100).toFixed(1)
    : "0.0";
  const conclusion = result.alertsSent
    ? "Les meilleures opportunités sont affichées ci-dessus."
    : alertsCreated
      ? "Des opportunités existent, mais Telegram n’a pas pu les envoyer. Vérifie le bot, ton compte Telegram et les alertes du radar."
      : "Aucune annonce ne respecte encore tous les critères de ce radar.";
  return `✅ Scan terminé\n\n🔎 ${result.candidatesFound} annonce(s) analysée(s)\n🚨 ${alertsCreated} opportunité(s) créée(s)\n🎯 Taux de sélection : ${selectedRate} %\n📨 ${result.alertsSent} alerte(s) Telegram envoyée(s)${telegramSkipped ? `\n⚠️ ${telegramSkipped} alerte(s) non envoyée(s) côté Telegram` : ""}\n\n${conclusion}${rejectionSummaryText(result.rejectionSummary)}${sourceErrorsText(result.sourceErrors)}\n\n_${SCAN_RESULT_FORMAT_VERSION}_`;
}
