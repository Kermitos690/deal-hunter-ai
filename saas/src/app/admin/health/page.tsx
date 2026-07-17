import Link from "next/link";
import { evaluateProductionGates } from "@/lib/admin/production-gates";
import { configuredSources, summarizeSourceLogs } from "@/lib/admin/source-health";
import { telegramHealth } from "@/lib/admin/telegram-health";
import { stripeConfigured, stripeEnabled } from "@/lib/billing/stripe";
import { serviceDb } from "@/lib/db/server";
import { missingEnvironmentVariables, productionConfigurationWarnings } from "@/lib/env";
import { requireAdmin } from "@/lib/security/session";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  await requireAdmin();
  const db = serviceDb();
  const now = new Date().toISOString();
  const day = new Date(Date.now() - 86_400_000).toISOString();
  const week = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const failedTelegramStatuses = [
    "telegram_token_missing",
    "telegram_forbidden",
    "telegram_bad_request",
    "telegram_rate_limited",
    "telegram_api_error"
  ];

  const [
    telegram,
    lastScan,
    lastSuccessfulScan,
    logs,
    dueRadars,
    lockedRadars,
    scanErrors,
    pendingAlerts,
    failedAlerts,
    schedulerRuns
  ] = await Promise.all([
    telegramHealth(),
    db.from("scan_logs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("scan_logs").select("*").eq("status", "success").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("source_scan_logs")
      .select("source,status,candidates_found,duration_ms,error_message,started_at,finished_at")
      .gte("started_at", week)
      .order("started_at", { ascending: false })
      .limit(1000),
    db.from("radars").select("*", { count: "exact", head: true }).eq("is_active", true).lte("next_scan_at", now),
    db.from("radar_scan_locks").select("*", { count: "exact", head: true }).gt("expires_at", now),
    db.from("scan_logs").select("*", { count: "exact", head: true }).eq("status", "error").gte("started_at", day),
    db.from("alerts").select("*", { count: "exact", head: true }).in("status", ["created", "inbox"]),
    db.from("alerts").select("*", { count: "exact", head: true }).in("status", failedTelegramStatuses),
    db.from("scheduler_runs")
      .select("job,status,started_at,finished_at,result_count,error_count,error_message")
      .order("started_at", { ascending: false })
      .limit(30)
  ]);

  const summaries = summarizeSourceLogs(logs.data ?? []);
  const summaryBySource = new Map(summaries.map((item) => [item.source, item]));
  const configurations = configuredSources();
  const latestScheduler = new Map<string, any>();
  for (const run of schedulerRuns.data ?? []) {
    if (!latestScheduler.has(run.job)) latestScheduler.set(run.job, run);
  }
  const schedulerLatest = Object.fromEntries(latestScheduler);
  const missing = missingEnvironmentVariables();
  const warnings = productionConfigurationWarnings();
  const databaseErrors = [
    lastScan.error,
    lastSuccessfulScan.error,
    logs.error,
    dueRadars.error,
    lockedRadars.error,
    scanErrors.error,
    pendingAlerts.error,
    failedAlerts.error,
    schedulerRuns.error
  ].filter(Boolean).map((error) => error?.message ?? "Erreur Supabase inconnue");
  const deployment = {
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
    url: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.APP_BASE_URL ?? null
  };
  const ebayConfig = configurations.find((item) => item.source === "ebay") ?? null;
  const ebayRuntime = summaryBySource.get("ebay") ?? null;
  const release = evaluateProductionGates({
    databaseErrors,
    missingEnvironmentVariables: missing,
    configurationWarnings: warnings,
    telegram: {
      status: telegram.status,
      botMatches: telegram.botMatches,
      webhookMatches: telegram.webhookMatches,
      pendingUpdateCount: telegram.pendingUpdateCount,
      lastErrorMessage: telegram.lastErrorMessage
    },
    failedAlerts: Number(failedAlerts.count ?? 0),
    lastSuccessfulScanAt: lastSuccessfulScan.data?.started_at ?? null,
    ebay: ebayConfig ? {
      configured: ebayConfig.status === "configured",
      successes: ebayRuntime?.successes ?? 0,
      candidates: ebayRuntime?.candidates ?? 0,
      lastSuccessAt: ebayRuntime?.lastSuccessAt ?? null,
      lastError: ebayRuntime?.lastError ?? null
    } : null,
    scheduler: schedulerLatest,
    deployment
  });

  return <main className="mx-auto max-w-7xl p-6 md:p-10">
    <Link href="/admin" className="text-slate-400">← Administration</Link>
    <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="badge text-mint">Production Truth Gate</div>
        <h1 className="mt-3 text-4xl font-black">System Health</h1>
        <p className="mt-2 text-slate-400">Verdict de publication fondé sur des preuves réelles, pas seulement sur la présence du code.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link className="button-secondary" href="/api/admin/health">Voir le JSON</Link>
        <a className="button-secondary" href="/api/admin/health?download=1">Exporter le rapport</a>
      </div>
    </div>

    <section className={`card mt-8 ${release.releaseReady ? "border-mint/40" : "border-red-500/40"}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Verdict bêta</p>
          <h2 className="mt-2 text-3xl font-black">{release.releaseReady ? "PRÊT" : "BLOQUÉ"}</h2>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Metric k="Passés" v={release.summary.passed}/>
          <Metric k="Alertes" v={release.summary.warnings}/>
          <Metric k="Blocages" v={release.summary.blockingFailures}/>
        </div>
      </div>
      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        {release.gates.map((item) => <div className="rounded-xl bg-black/20 p-4" key={item.id}>
          <div className="flex items-center justify-between gap-3">
            <strong>{item.label}</strong>
            <span className="badge">{item.status}</span>
          </div>
          <p className="mt-2 text-sm text-slate-300">{item.evidence}</p>
          {item.action && <p className="mt-2 text-xs text-orange-200">Action : {item.action}</p>}
        </div>)}
      </div>
    </section>

    <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatusCard title="Base de données" status={databaseErrors.length ? "degraded" : "connected"} detail={databaseErrors.length ? `${databaseErrors.length} erreur(s) de lecture` : "Requêtes de santé réussies"}/>
      <StatusCard title="Telegram" status={telegram.status} detail={telegram.botUsername ? `@${telegram.botUsername}` : "Bot non vérifié"}/>
      <StatusCard title="Stripe" status={!stripeEnabled() ? "disabled" : stripeConfigured() ? "configured" : "misconfigured"} detail={!stripeEnabled() ? "Bêta privée sans paiement" : "Activation explicite"}/>
      <StatusCard title="Déploiement" status={deployment.environment ?? "unknown"} detail={deployment.commit?.slice(0, 8) ?? "Commit absent"}/>
    </section>

    <section className="card mt-6">
      <h2 className="text-xl font-bold">Telegram réel</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric k="Bot attendu" v={telegram.expectedBotUsername ? `@${telegram.expectedBotUsername}` : "Non défini"}/>
        <Metric k="Bot vérifié" v={telegram.botMatches === null ? "Non testé" : telegram.botMatches ? "Oui" : "Non"}/>
        <Metric k="Webhook vérifié" v={telegram.webhookMatches === null ? "Non testé" : telegram.webhookMatches ? "Oui" : "Non"}/>
        <Metric k="Updates en attente" v={telegram.pendingUpdateCount ?? "—"}/>
      </div>
      {telegram.lastErrorMessage && <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">Dernière erreur Telegram : {telegram.lastErrorMessage}</p>}
    </section>

    <section className="card mt-6">
      <h2 className="text-xl font-bold">Exploitation</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Metric k="Radars dus" v={dueRadars.count ?? 0}/>
        <Metric k="Verrous actifs" v={lockedRadars.count ?? 0}/>
        <Metric k="Erreurs scans 24h" v={scanErrors.count ?? 0}/>
        <Metric k="Alertes en attente" v={pendingAlerts.count ?? 0}/>
        <Metric k="Alertes Telegram échouées" v={failedAlerts.count ?? 0}/>
      </div>
      <p className="mt-4 text-sm text-slate-400">Dernier scan : {lastScan.data ? `${lastScan.data.status} — ${new Date(lastScan.data.started_at).toLocaleString("fr-CH")}` : "aucun"}</p>
    </section>

    <section className="card mt-6">
      <h2 className="text-xl font-bold">Schedulers</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {["scan", "reminders", "email-alerts"].map((job) => {
          const run = latestScheduler.get(job);
          return <div className="rounded-xl bg-black/20 p-4" key={job}>
            <div className="flex items-center justify-between gap-3"><strong>{job}</strong><span className="badge">{run?.status ?? "untested"}</span></div>
            <p className="mt-2 text-sm text-slate-400">{run?.started_at ? new Date(run.started_at).toLocaleString("fr-CH") : "Aucune exécution journalisée"}</p>
            {run && <p className="mt-2 text-xs text-slate-500">Résultats {run.result_count} · erreurs {run.error_count}</p>}
          </div>;
        })}
      </div>
    </section>

    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {configurations.map((config) => {
        const health = summaryBySource.get(config.source);
        return <section className="card" key={config.source}>
          <div className="flex items-center justify-between gap-3"><h2 className="font-black">{config.source}</h2><span className="badge">{config.status}</span></div>
          <p className="mt-2 text-sm text-slate-400">{config.detail}</p>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <Metric k="Santé réelle" v={health?.health ?? "untested"}/>
            <Metric k="Scans" v={health?.scans ?? 0}/>
            <Metric k="Erreurs" v={health?.errors ?? 0}/>
            <Metric k="Candidats" v={health?.candidates ?? 0}/>
          </dl>
          <p className="mt-4 text-xs text-slate-500">Dernier succès : {health?.lastSuccessAt ? new Date(health.lastSuccessAt).toLocaleString("fr-CH") : "aucun"}</p>
          {health?.lastError && <p className="mt-2 rounded-lg bg-red-500/10 p-2 text-xs text-red-300">{health.lastError}</p>}
        </section>;
      })}
    </div>

    {(missing.length > 0 || warnings.length > 0) && <section className="card mt-6">
      <h2 className="font-bold">Configuration à corriger</h2>
      {missing.length > 0 && <p className="mt-3 text-sm text-red-300">Variables manquantes : {missing.join(", ")}</p>}
      {warnings.length > 0 && <p className="mt-3 text-sm text-orange-200">Avertissements : {warnings.join(" ; ")}</p>}
    </section>}
  </main>;
}

function StatusCard({title,status,detail}:{title:string;status:string;detail:string}) {
  return <div className="card"><div className="flex items-center justify-between gap-3"><h2 className="font-bold">{title}</h2><span className="badge">{status}</span></div><p className="mt-3 text-sm text-slate-400">{detail}</p></div>;
}

function Metric({k,v}:{k:string;v:string|number}) {
  return <div className="rounded-xl bg-black/20 p-3"><dt className="text-xs text-slate-500">{k}</dt><dd className="mt-1 font-bold">{v}</dd></div>;
}
