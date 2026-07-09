export type SourceLog = {
  source: string; status: string; candidates_found: number; duration_ms: number;
  error_message?: string | null; started_at: string; finished_at: string;
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
      lastSuccessAt: successes.sort((a,b)=>b.started_at.localeCompare(a.started_at))[0]?.finished_at ?? null,
      lastErrorAt: errors.sort((a,b)=>b.started_at.localeCompare(a.started_at))[0]?.finished_at ?? null,
      lastError: errors.sort((a,b)=>b.started_at.localeCompare(a.started_at))[0]?.error_message ?? null
    };
  }).sort((a,b)=>a.source.localeCompare(b.source));
}

export function configuredSources() {
  const liveProxyDetail = process.env.LIVE_SOURCE_PROXY_URL || process.env.SWISS_SOURCE_PROXY_URL
    ? "Proxy live configuré pour éviter les blocages IP Vercel"
    : "Accès direct Vercel, risque HTTP 403 sur marketplaces suisses";
  return [
    { source:"ebay", status:process.env.ENABLE_EBAY_SOURCE==="true"?"active":"inactive", detail:process.env.EBAY_CLIENT_ID&&process.env.EBAY_CLIENT_SECRET?"OAuth configuré":"Identifiants manquants" },
    { source:"ricardo", status:process.env.ENABLE_RICARDO_SOURCE==="false"?"inactive":"active", detail:`Marketplace suisse, annonces actives vérifiées par page détail. ${liveProxyDetail}` },
    { source:"anibis", status:process.env.ENABLE_ANIBIS_SOURCE==="false"?"inactive":"active", detail:`Marketplace suisse, annonces actives vérifiées par page détail. ${liveProxyDetail}` },
    { source:"tutti", status:process.env.ENABLE_TUTTI_SOURCE==="false"?"inactive":"active", detail:`Marketplace suisse live, annonces acceptées seulement après vérification page détail + prix. ${liveProxyDetail}` },
    { source:"komehyo", status:process.env.ENABLE_KOMEHYO_SOURCE==="false"?"inactive":"active", detail:"Catalogue public Japon, annonces actives pondérées" },
    { source:"email-alerts", status:process.env.ENABLE_EMAIL_ALERTS_SOURCE==="true"?"active":"inactive", detail:process.env.EMAIL_ADDRESS&&process.env.EMAIL_APP_PASSWORD?`IMAP configuré, mailbox ${process.env.EMAIL_MAILBOX || "INBOX"}, lookback ${process.env.EMAIL_LOOKBACK_HOURS ?? 48} h`:"IMAP incomplet" },
    { source:"rss", status:process.env.ENABLE_RSS_SOURCE==="true"?"active":"inactive", detail:process.env.PUBLIC_FEED_URLS?"Flux configuré":"Aucun flux" },
    { source:"whatsapp", status:process.env.WHATSAPP_ACCESS_TOKEN&&process.env.WHATSAPP_PHONE_NUMBER_ID?"active":"inactive", detail:"Canal d’alerte, pas une source de produits" },
    { source:"yahoo-japan", status:"not_configured", detail:"Connecteur développé, Client ID absent" },
    { source:"stockx", status:"not_developed", detail:"Non développé" }
  ];
}
