export type SourceLog = {
  source: string;
  status: string;
  candidates_found: number;
  duration_ms: number;
  error_message?: string | null;
  started_at: string;
  finished_at: string;
};

export function summarizeSourceLogs(logs: SourceLog[]) {
  const groups = new Map<string, SourceLog[]>();
  logs.forEach((log) => groups.set(log.source, [...(groups.get(log.source) ?? []), log]));
  return [...groups.entries()].map(([source, entries]) => {
    const successes = entries.filter((entry) => entry.status === "success");
    const errors = entries.filter((entry) => entry.status === "error");
    return {
      source,
      scans: entries.length,
      successes: successes.length,
      errors: errors.length,
      candidates: entries.reduce((sum, entry) => sum + entry.candidates_found, 0),
      averageDurationMs: Math.round(entries.reduce((sum, entry) => sum + entry.duration_ms, 0) / entries.length),
      lastSuccessAt: successes.sort((a, b) => b.started_at.localeCompare(a.started_at))[0]?.finished_at ?? null,
      lastErrorAt: errors.sort((a, b) => b.started_at.localeCompare(a.started_at))[0]?.finished_at ?? null,
      lastError: errors.sort((a, b) => b.started_at.localeCompare(a.started_at))[0]?.error_message ?? null
    };
  }).sort((a, b) => a.source.localeCompare(b.source));
}

type ConfigStatus = "active" | "disabled" | "misconfigured" | "not_developed";
const enabled = (name: string) => process.env[name] === "true";

function config(source: string, flag: string, ready: boolean, activeDetail: string, missingDetail: string) {
  const isEnabled = enabled(flag);
  const status: ConfigStatus = !isEnabled ? "disabled" : ready ? "active" : "misconfigured";
  return {
    source,
    status,
    detail: !isEnabled ? `Désactivé par ${flag}` : ready ? activeDetail : missingDetail
  };
}

export function configuredSources() {
  const proxyConfigured = Boolean(process.env.LIVE_SOURCE_PROXY_URL || process.env.SWISS_SOURCE_PROXY_URL);
  const swissDetail = proxyConfigured
    ? "Proxy live configuré pour limiter les blocages IP Vercel"
    : "Accès direct Vercel : risque de HTTP 403 et de disponibilité variable";

  return [
    config("mock", "ENABLE_MOCK_SOURCE", true, "Fixture de test uniquement — interdite pour les utilisateurs bêta", "Configuration mock invalide"),
    config("ebay", "ENABLE_EBAY_SOURCE", Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET), "OAuth eBay configuré", "Identifiants OAuth eBay manquants"),
    config("ricardo", "ENABLE_RICARDO_SOURCE", true, `Marketplace suisse. ${swissDetail}`, "Configuration Ricardo incomplète"),
    config("anibis", "ENABLE_ANIBIS_SOURCE", true, `Marketplace suisse. ${swissDetail}`, "Configuration Anibis incomplète"),
    config("tutti", "ENABLE_TUTTI_SOURCE", true, `Marketplace suisse. ${swissDetail}`, "Configuration Tutti incomplète"),
    config("komehyo", "ENABLE_KOMEHYO_SOURCE", true, "Catalogue public Japon, annonces actives pondérées", "Configuration KOMEHYO incomplète"),
    config("email-alerts", "ENABLE_EMAIL_ALERTS_SOURCE", Boolean(process.env.EMAIL_IMAP_SERVER && process.env.EMAIL_ADDRESS && process.env.EMAIL_APP_PASSWORD), `IMAP configuré, mailbox ${process.env.EMAIL_MAILBOX || "INBOX"}`, "Variables IMAP incomplètes"),
    config("rss", "ENABLE_RSS_SOURCE", Boolean(process.env.PUBLIC_FEED_URLS), "Flux publics configurés", "PUBLIC_FEED_URLS manquant"),
    config("yahoo-japan", "ENABLE_YAHOO_JAPAN_SOURCE", Boolean(process.env.YAHOO_JAPAN_CLIENT_ID), "Client ID configuré", "YAHOO_JAPAN_CLIENT_ID manquant"),
    {
      source: "whatsapp",
      status: process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID ? "active" : "disabled",
      detail: "Canal d’alerte, pas une source de produits"
    },
    { source: "stockx", status: "not_developed", detail: "Non développé" }
  ];
}
