import { NextResponse } from "next/server";
import { runScheduledJob } from "@/lib/cron/run-scheduled-job";
import { runDueScans } from "@/lib/scans/run-radar-scan";
import { serviceDb } from "@/lib/db/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function runDueScansWithReferralRefresh() {
  const { error } = await serviceDb().rpc("refresh_referral_entitlements");
  if (error) throw new Error(`Referral entitlement refresh failed: ${error.message}`);
  return runDueScans();
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runScheduledJob("scan", runDueScansWithReferralRefresh), {
      headers: { "cache-control": "no-store" }
    });
  } catch (error) {
    console.error("Scheduled radar scan failed:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Scheduled radar scan failed." }, { status: 500 });
  }
}
