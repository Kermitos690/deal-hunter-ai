import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    app: "deal-hunter-ai-saas",
    scanResultFormat: "scan-v4",
    deployedAt: "2026-07-09T03:35:00+02:00",
    gitCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    sources: ["ebay", "ricardo", "anibis", "komehyo", "email-alerts", "rss"]
  });
}
