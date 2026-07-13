import { describe, expect, it } from "vitest";
import { summarizeScheduledResult } from "@/lib/cron/run-scheduled-job";

describe("scheduler result summary", () => {
  it("counts failed radar results", () => {
    expect(summarizeScheduledResult([{ ok: true }, { ok: false }, { ok: true }]))
      .toEqual({ resultCount: 3, errorCount: 1 });
  });

  it("counts reminder terminal failures", () => {
    expect(summarizeScheduledResult({ processed: 4, skipped: 2, failed: 1 }))
      .toEqual({ resultCount: 7, errorCount: 1 });
  });
});
