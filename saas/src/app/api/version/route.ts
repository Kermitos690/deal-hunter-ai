import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    app: "deal-hunter-ai-saas",
    release: "private-beta-readiness",
    scanEngine: "scan-v5",
    wizard: "category-intent-v2",
    scoring: "v4",
    telegramActions: "full-analysis-v1",
    telegramSetup: "verified-webhook-v2",
    telegramSetupAuth: "admin-or-cron-secret-v2",
    schedulerJournal: "scheduler-runs-v1",
    whatsapp: "cloud-api-mvp-v1",
    gitCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    gitBranch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
    deploymentUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    sources: ["ebay", "ricardo", "anibis", "tutti", "komehyo", "email-alerts", "rss"],
    checkedAt: new Date().toISOString()
  }, { headers: { "cache-control": "no-store" } });
}
