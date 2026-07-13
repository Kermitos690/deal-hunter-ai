export type SourceLog = {
  source: string;
  status: string;
  candidates_found: number;
  duration_ms: number;
  error_message?: string | null;
  started_at: string;
  finished_at: string;
};

export type SourceRuntimeHealth = "healthy" | "degraded" | "rate_limited" | "auth_error" | "untested";
export type SourceConfigurationStatus = "configured" | "disabled" | "misconfigured" | "test_only" | "not_developed";

function runtimeHealth(entries: SourceLog[]): SourceRuntimeHealth {
  if (!entries.length) return "untested";
  const ordered = [...entries].sort((a, b) => b.started_at.localeCompare(a.started_at));
  const latest = ordered[0];
  const latestError = latest.error_message?.toLowerCase() ?? "";
  if (latest.status === "error" && /429|rate.?limit|too many requests/.test(latestError)) return "rate_limited";
  if (latest.status === "error" && /401|unauthori[sz]ed|oauth|invalid.?token|auth/.test(latestError)) return "auth_error";
  if (latest.status === "error") return "degraded";
  return "healthy";
}

export function summarizeSourceLogs(logs: SourceLog[]) {
  const groups = new Map<string, SourceLog[]>();
  logs.forEach((log) => groups.set(log.source, [...(groups.get(log.source) ?? []), log]));
  return [...groups.entries()].map(([source, entries]) => {
    const successes = entries.filter((entry) => entry.status === "success");
    const errors = entries.filter((entry) => entry.status === "error");
    const latestSuccess = [...successes].sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
    const latestError = [...errors].sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
    return {
      source,
      health: runtimeHealth(entries),
      scans: entries.length,
      successes: successes.length,
      errors: errors.length,
      candidates: entries.reduce((sum, entry) => sum + entry.candidates_found, 0),
      averageDurationMs: Math.round(entries.reduce((sum, entry) => sum + entry.duration_ms, 0) / entries.length),
      lastSuccessAt: latestSuccess?.finished_at ?? null,
      lastErrorAt: latestError?.finished_at ?? null,
      lastError: latestError?.error_message ?? null
    };
  }).sort((a, b) => a.source.localeCompare(b.source));
}

function configured(flag: string | undefined, ready = true): SourceConfigurationStatus {
  if (flag !== "true") return "disabled";
  return ready ? "configured" : "misconfigured";
}

export function configuredSources() {
  const liveProxyDetail = process.env.LIVE_SOURCE_PROXY_URL || process.env.SWISS_SOURCE_PROXY_URL
    ? "Proxy live configuré pour réduire les blocages IP Vercel"
    : "Accès direct Vercel, risque HTTP 403 sur marketplaces suisses";
  const ebayReady = Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
  const emailReady = Boolean(process.env.EMAIL_IMAP_SERVER && process.env.EMAIL_ADDRESS && process.env.EMAIL_APP_PASSWORD);
  const rssReady = Boolean(process.env.PUBLIC_FEED_URLS);
  const yahooReady = Boolean(process.env.YAHOO_JAPAN_CLIENT_ID);
  const whatsappReady = Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.WHATSAPP_VERIFY_TOKEN &&
    process.env.WHATSAPP_APP_SECRET
  );
  return [
    {
      source: "mock",
      status: process.env.ENABLE_MOCK_SOURCE === "true" ? "test_only" as const : "disabled" as const,
      detail: "Fixture contrôlée. Ne doit pas alimenter les utilisateurs bêta."
    },
    {
      source: "ebay",
      status: configured(process.env.ENABLE_EBAY_SOURCE, ebayReady),
      detail: ebayReady ? "OAuth configuré; fonctionnement réel à confirmer par source_scan_logs" : "Identifiants OAuth manquants"
    },
    {
      source: "ricardo",
      status: configured(process.env.ENABLE_RICARDO_SOURCE),
      detail: `Collecteur HTML bêta avec vérification de page détail. ${liveProxyDetail}`
    },
    {
      source: "anibis",
      status: configured(process.env.ENABLE_ANIBIS_SOURCE),
      detail: `Collecteur HTML bêta avec vérification de page détail. ${liveProxyDetail}`
    },
    {
      source: "tutti",
      status: configured(process.env.ENABLE_TUTTI_SOURCE),
      detail: `Collecteur HTML bêta avec vérification de disponibilité et prix. ${liveProxyDetail}`
    },
    {
      source: "komehyo",
      status: configured(process.env.ENABLE_KOMEHYO_SOURCE),
      detail: "Catalogue public Japon; annonces actives pondérées comme signaux faibles"
    },
    {
      source: "email-alerts",
      status: configured(process.env.ENABLE_EMAIL_ALERTS_SOURCE, emailReady),
      detail: emailReady
        ? `IMAP configuré, mailbox ${process.env.EMAIL_MAILBOX || "INBOX"}, lookback ${process.env.EMAIL_LOOKBACK_HOURS ?? 48} h`
        : "Configuration IMAP incomplète"
    },
    {
      source: "rss",
      status: configured(process.env.ENABLE_RSS_SOURCE, rssReady),
      detail: rssReady ? "Flux publics configurés" : "Aucun flux configuré"
    },
    {
      source: "yahoo-japan",
      status: configured(process.env.ENABLE_YAHOO_JAPAN_SOURCE, yahooReady),
      detail: yahooReady ? "Client ID configuré; test réel requis" : "Client ID absent"
    },
    {
      source: "whatsapp",
      status: configured(process.env.ENABLE_WHATSAPP, whatsappReady),
      detail: whatsappReady
        ? "Canal signé Meta configuré; test réel requis"
        : "Canal d’alerte désactivé ou configuration Meta incomplète"
    },
    { source: "stockx", status: "not_developed" as const, detail: "Non développé" }
  ];
}
