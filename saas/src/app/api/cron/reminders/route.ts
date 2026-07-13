import { NextResponse } from "next/server";
import { runScheduledJob } from "@/lib/cron/run-scheduled-job";
import { runDueReminders } from "@/lib/scans/run-reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runScheduledJob("reminders", runDueReminders), {
      headers: { "cache-control": "no-store" }
    });
  } catch (error) {
    console.error("Scheduled reminders failed:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Scheduled reminders failed." }, { status: 500 });
  }
}
