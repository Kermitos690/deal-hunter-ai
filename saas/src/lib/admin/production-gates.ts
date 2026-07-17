export type ProductionGateStatus = "pass" | "warn" | "fail";

export type ProductionGate = {
  id: string;
  label: string;
  status: ProductionGateStatus;
  evidence: string;
  action: string | null;
  blocking: boolean;
};

export type ProductionGateInput = {
  databaseErrors: string[];
  missingEnvironmentVariables: string[];
  configurationWarnings: string[];
  telegram: {
    status: string;
    botMatches: boolean | null;
    webhookMatches: boolean | null;
    pendingUpdateCount: number | null;
    lastErrorMessage: string | null;
  };
  failedAlerts: number;
  lastSuccessfulScanAt: string | null;
  ebay: {
    configured: boolean;
    successes: number;
    candidates: number;
    lastSuccessAt: string | null;
    lastError: string | null;
  } | null;
  scheduler: Record<string, { status?: unknown; started_at?: unknown; error_message?: unknown }>;
  deployment: {
    commit: string | null;
    branch: string | null;
    environment: string | null;
    url: string | null;
  };
};

function gate(
  id: string,
  label: string,
  status: ProductionGateStatus,
  evidence: string,
  action: string | null,
  blocking = true
): ProductionGate {
  return { id, label, status, evidence, action, blocking };
}

function schedulerGate(
  input: ProductionGateInput,
  job: string,
  required: boolean
): ProductionGate {
  const run = input.scheduler[job];
  const status = typeof run?.status === "string" ? run.status : null;
  const startedAt = typeof run?.started_at === "string" ? run.started_at : null;
  const error = typeof run?.error_message === "string" ? run.error_message : null;

  if (!run) {
    return gate(
      `scheduler-${job}`,
      `Scheduler ${job}`,
      required ? "fail" : "warn",
      "Aucune exécution journalisée.",
      `Exécuter et vérifier le job ${job}.`,
      required
    );
  }
  if (status !== "success") {
    return gate(
      `scheduler-${job}`,
      `Scheduler ${job}`,
      required ? "fail" : "warn",
      `${status ?? "inconnu"}${error ? ` — ${error}` : ""}`,
      `Corriger puis relancer le job ${job}.`,
      required
    );
  }
  return gate(
    `scheduler-${job}`,
    `Scheduler ${job}`,
    "pass",
    startedAt ? `Dernier succès ${startedAt}.` : "Dernière exécution réussie.",
    null,
    required
  );
}

export function evaluateProductionGates(input: ProductionGateInput) {
  const gates: ProductionGate[] = [];

  gates.push(input.databaseErrors.length === 0
    ? gate("database", "Base Supabase", "pass", "Toutes les lectures de santé ont réussi.", null)
    : gate("database", "Base Supabase", "fail", input.databaseErrors.join(" ; "), "Vérifier les migrations, tables et politiques RLS."));

  gates.push(input.missingEnvironmentVariables.length === 0
    ? gate("environment-required", "Variables obligatoires", "pass", "Aucune variable obligatoire manquante.", null)
    : gate("environment-required", "Variables obligatoires", "fail", input.missingEnvironmentVariables.join(", "), "Compléter les variables de production puis redéployer."));

  gates.push(input.configurationWarnings.length === 0
    ? gate("environment-warnings", "Configuration prudente", "pass", "Aucun avertissement de configuration.", null, false)
    : gate("environment-warnings", "Configuration prudente", "warn", input.configurationWarnings.join(" ; "), "Revoir les feature flags et les sources activées.", false));

  gates.push(input.deployment.environment === "production" && Boolean(input.deployment.commit) && Boolean(input.deployment.url)
    ? gate("deployment", "Déploiement identifiable", "pass", `${input.deployment.commit} — ${input.deployment.url}`, null)
    : gate("deployment", "Déploiement identifiable", "fail", `env=${input.deployment.environment ?? "inconnu"}, commit=${input.deployment.commit ?? "absent"}, url=${input.deployment.url ?? "absente"}`, "Vérifier l’intégration Git Vercel et les métadonnées de déploiement."));

  gates.push(input.telegram.status === "healthy" && input.telegram.botMatches === true
    ? gate("telegram-bot", "Bot Telegram attendu", "pass", "getMe correspond au bot configuré.", null)
    : gate("telegram-bot", "Bot Telegram attendu", "fail", input.telegram.lastErrorMessage ?? `status=${input.telegram.status}, match=${String(input.telegram.botMatches)}`, "Vérifier TELEGRAM_BOT_TOKEN et NEXT_PUBLIC_TELEGRAM_BOT_USERNAME."));

  gates.push(input.telegram.webhookMatches === true
    ? gate("telegram-webhook", "Webhook Telegram", "pass", `Webhook correct, ${input.telegram.pendingUpdateCount ?? 0} update(s) en attente.`, null)
    : gate("telegram-webhook", "Webhook Telegram", "fail", input.telegram.lastErrorMessage ?? `match=${String(input.telegram.webhookMatches)}`, "Réinstaller le webhook sur l’URL de production avec le secret attendu."));

  gates.push(input.failedAlerts === 0
    ? gate("telegram-delivery", "Livraisons Telegram", "pass", "Aucune alerte Telegram en échec persistant.", null)
    : gate("telegram-delivery", "Livraisons Telegram", "fail", `${input.failedAlerts} alerte(s) en échec.`, "Analyser les statuts Telegram et retraiter seulement les erreurs transitoires."));

  gates.push(input.lastSuccessfulScanAt
    ? gate("scan-success", "Scan applicatif réussi", "pass", `Dernier succès ${input.lastSuccessfulScanAt}.`, null)
    : gate("scan-success", "Scan applicatif réussi", "fail", "Aucun scan réussi trouvé.", "Lancer un radar réel et conserver les journaux."));

  if (!input.ebay?.configured) {
    gates.push(gate("ebay", "Source eBay réelle", "fail", input.ebay?.lastError ?? "Source non configurée.", "Configurer eBay puis lancer un scan réel."));
  } else if (input.ebay.successes > 0 && input.ebay.candidates > 0) {
    gates.push(gate("ebay", "Source eBay réelle", "pass", `${input.ebay.successes} scan(s) réussi(s), ${input.ebay.candidates} candidat(s), dernier succès ${input.ebay.lastSuccessAt ?? "inconnu"}.`, null));
  } else {
    gates.push(gate("ebay", "Source eBay réelle", "fail", input.ebay.lastError ?? "Aucun scan eBay réussi avec candidat sur la fenêtre observée.", "Exécuter un scan eBay réel et vérifier OAuth, filtres et journaux."));
  }

  gates.push(schedulerGate(input, "scan", true));
  gates.push(schedulerGate(input, "reminders", false));
  gates.push(schedulerGate(input, "email-alerts", false));

  const blockingFailures = gates.filter((item) => item.blocking && item.status === "fail").length;
  const warnings = gates.filter((item) => item.status === "warn").length;
  const passed = gates.filter((item) => item.status === "pass").length;

  return {
    releaseReady: blockingFailures === 0,
    verdict: blockingFailures === 0 ? "ready" : "blocked",
    summary: { passed, warnings, blockingFailures, total: gates.length },
    gates
  };
}
