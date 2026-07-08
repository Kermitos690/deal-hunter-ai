import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    app: "deal-hunter-ai-saas",
    scanResultFormat: "scan-v2",
    deployedAt: "2026-07-09T02:05:00+02:00",
    gitCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null
  });
}
