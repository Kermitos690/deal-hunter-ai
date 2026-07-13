import { serviceDb } from "@/lib/db/server";

export type ScheduledJobName = "scan" | "reminders" | "email-alerts";

type ScheduledJobResult<T> = {
  status: "success" | "degraded";
  results: T;
  resultCount: number;
  errorCount: number;
};

export function summarizeScheduledResult(result: unknown) {
  if (Array.isArray(result)) {
    return {
      resultCount: result.length,
      errorCount: result.filter((entry) =>
        entry && typeof entry === "object" && "ok" in entry && (entry as { ok?: unknown }).ok !== true
      ).length
    };
  }
  if (result && typeof result === "object") {
    const record = result as Record<string, unknown>;
    const processed = Number(record.processed ?? 0);
    const skipped = Number(record.skipped ?? 0);
    const failed = Number(record.failed ?? 0);
    const safeProcessed = Number.isFinite(processed) ? processed : 0;
    const safeSkipped = Number.isFinite(skipped) ? skipped : 0;
    const safeFailed = Number.isFinite(failed) ? failed : 0;
    return {
      resultCount: safeProcessed + safeSkipped + safeFailed,
      errorCount: safeFailed
    };
  }
  return { resultCount: 0, errorCount: 0 };
}

export async function runScheduledJob<T>(job: ScheduledJobName, operation: () => Promise<T>): Promise<ScheduledJobResult<T>> {
  const db = serviceDb();
  const startedAt = new Date().toISOString();
  const { data: journal, error: journalError } = await db
    .from("scheduler_runs")
    .insert({ job, status: "running", started_at: startedAt })
    .select("id")
    .maybeSingle();
  if (journalError) {
    console.warn("Scheduler journal unavailable:", journalError.message);
  }

  try {
    const results = await operation();
    const summary = summarizeScheduledResult(results);
    const status = summary.errorCount > 0 ? "degraded" : "success";
    if (journal?.id) {
      const { error } = await db.from("scheduler_runs").update({
        status,
        finished_at: new Date().toISOString(),
        result_count: summary.resultCount,
        error_count: summary.errorCount
      }).eq("id", journal.id);
      if (error) console.warn("Scheduler journal completion failed:", error.message);
    }
    return { status, results, ...summary };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Scheduled job failed";
    if (journal?.id) {
      const { error: updateError } = await db.from("scheduler_runs").update({
        status: "error",
        finished_at: new Date().toISOString(),
        error_count: 1,
        error_message: message
      }).eq("id", journal.id);
      if (updateError) console.warn("Scheduler journal failure update failed:", updateError.message);
    }
    throw error;
  }
}
