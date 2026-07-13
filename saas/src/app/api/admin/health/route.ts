import { NextResponse } from "next/server";
import { apiUser, isAdmin, jsonError } from "@/lib/api";
import { configuredSources, summarizeSourceLogs } from "@/lib/admin/source-health";
import { telegramHealth } from "@/lib/admin/telegram-health";
import { stripeConfigured, stripeEnabled } from "@/lib/billing/stripe";
import { serviceDb } from "@/lib/db/server";
import { missingEnvironmentVariables, productionConfigurationWarnings } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await apiUser();
  if ("response" in auth) return auth.response;
  if (!isAdmin(auth.user)) return jsonError("Accès administrateur requis.", 403);

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
    users,
    activeUsers,
    suspendedUsers,
    activeRadars,
    dueRadars,
    lockedRadars,
    lastScan,
    lastSuccessfulScan,
    scanErrors,
    sourceLogs,
    pendingAlerts,
    failedAlerts,
    schedulerRuns
  ] = await Promise.all([
    telegramHealth(),
    db.from("users").select("*", { count: "exact", head: true }),
    db.from("users").select("*", { count: "exact", head: true }).eq("status", "active"),
    db.from("users").select("*", { count: "exact", head: true }).eq("status", "suspended"),
    db.from("radars").select("*", { count: "exact", head: true }).eq("is_active", true),
    db.from("radars").select("*", { count: "exact", head: true }).eq("is_active", true).lte("next_scan_at", now),
    db.from("radar_scan_locks").select("*", { count: "exact", head: true }).gt("expires_at", now),
    db.from("scan_logs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("scan_logs").select("*").eq("status", "success").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("scan_logs").select("*", { count: "exact", head: true }).eq("status", "error").gte("started_at", day),
    db.from("source_scan_logs")
      .select("source,status,candidates_found,duration_ms,error_message,started_at,finished_at")
      .gte("started_at", week)
      .order("started_at", { ascending: false })
      .limit(1000),
    db.from("alerts").select("*", { count: "exact", head: true }).in("status", ["created", "inbox"]),
    db.from("alerts").select("*", { count: "exact", head: true }).in("status", failedTelegramStatuses),
    db.from("scheduler_runs")
      .select("job,status,started_at,finished_at,result_count,error_count,error_message")
      .order("started_at", { ascending: false })
      .limit(30)
  ]);

  const databaseResults = [
    users,
    activeUsers,
    suspendedUsers,
    activeRadars,
    dueRadars,
    lockedRadars,
    lastScan,
    lastSuccessfulScan,
    scanErrors,
    sourceLogs,
    pendingAlerts,
    failedAlerts,
    schedulerRuns
  ];
  const databaseErrors = databaseResults
    .map((result) => result.error?.message)
    .filter((message): message is string => Boolean(message));

  const sourceSummaries = summarizeSourceLogs(sourceLogs.data ?? []);
  const summaryBySource = new Map(sourceSummaries.map((summary) => [summary.source, summary]));
  const sources = configuredSources().map((configuration) => ({
    ...configuration,
    runtime: summaryBySource.get(configuration.source) ?? {
      source: configuration.source,
      health: "untested",
      scans: 0,
      successes: 0,
      errors: 0,
      candidates: 0,
      averageDurationMs: 0,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastError: null
    }
  }));

  const latestSchedulerRunByJob = new Map<string, Record<string, unknown>>();
  for (const run of schedulerRuns.data ?? []) {
    if (!latestSchedulerRunByJob.has(run.job)) latestSchedulerRunByJob.set(run.job, run);
  }

  const missing = missingEnvironmentVariables();
  const configurationWarnings = productionConfigurationWarnings();
  const degraded =
    missing.length > 0 ||
    configurationWarnings.length > 0 ||
    databaseErrors.length > 0 ||
    telegram.status !== "healthy" ||
    Number(failedAlerts.count ?? 0) > 0;

  return NextResponse.json({
    status: degraded ? "degraded" : "ok",
    database: {
      status: databaseErrors.length ? "degraded" : "connected",
      errors: databaseErrors
    },
    telegram,
    scheduler: {
      configured: Boolean(process.env.CRON_SECRET),
      latest: Object.fromEntries(latestSchedulerRunByJob)
    },
    deployment: {
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
      url: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.APP_BASE_URL ?? null
    },
    stripe: {
      enabled: stripeEnabled(),
      configured: stripeConfigured(),
      state: !stripeEnabled()
        ? "disabled_private_beta"
        : stripeConfigured()
          ? "configured_test_required"
          : "misconfigured"
    },
    emailAlerts: {
      enabled: process.env.ENABLE_EMAIL_ALERTS_SOURCE === "true",
      configured: Boolean(process.env.EMAIL_IMAP_SERVER && process.env.EMAIL_ADDRESS && process.env.EMAIL_APP_PASSWORD)
    },
    environment: {
      missingVariables: missing,
      warnings: configurationWarnings,
      betaPrivateMode: process.env.BETA_PRIVATE_MODE !== "false"
    },
    counts: {
      users: users.count ?? 0,
      activeUsers: activeUsers.count ?? 0,
      suspendedUsers: suspendedUsers.count ?? 0,
      activeRadars: activeRadars.count ?? 0,
      dueRadars: dueRadars.count ?? 0,
      lockedRadars: lockedRadars.count ?? 0,
      scanErrors24h: scanErrors.count ?? 0,
      pendingAlerts: pendingAlerts.count ?? 0,
      failedAlerts: failedAlerts.count ?? 0
    },
    lastScan: lastScan.data ?? null,
    lastSuccessfulScan: lastSuccessfulScan.data ?? null,
    sources,
    checkedAt: new Date().toISOString()
  }, { headers: { "cache-control": "no-store" } });
}
