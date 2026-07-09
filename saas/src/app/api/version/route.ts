import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    app: "deal-hunter-ai-saas",
    scanResultFormat: "scan-v5",
    wizard: "category-intent-v2",
    telegramActions: "full-analysis-v1",
    deployedAt: "2026-07-09T03:55:00+02:00",
    gitCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    sources: ["ebay", "ricardo", "anibis", "komehyo", "email-alerts", "rss"]
  });
}
