import { NextResponse } from "next/server";
import { runScheduledJob } from "@/lib/cron/run-scheduled-job";
import { runDueScans } from "@/lib/scans/run-radar-scan";

export const dynamic = "force-dynamic";
export const maxDuration = 360;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runScheduledJob("scan", runDueScans), {
      headers: { "cache-control": "no-store" }
    });
  } catch (error) {
    console.error("Scheduled radar scan failed:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Scheduled radar scan failed." }, { status: 500 });
  }
}
