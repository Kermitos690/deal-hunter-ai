import { describe, expect, it } from "vitest";
import { evaluateProductionGates } from "@/lib/admin/production-gates";

const healthy = {
  databaseErrors: [],
  missingEnvironmentVariables: [],
  configurationWarnings: [],
  telegram: {
    status: "healthy",
    botMatches: true,
    webhookMatches: true,
    pendingUpdateCount: 0,
    lastErrorMessage: null
  },
  failedAlerts: 0,
  lastSuccessfulScanAt: "2026-07-17T10:00:00.000Z",
  ebay: {
    configured: true,
    successes: 2,
    candidates: 8,
    lastSuccessAt: "2026-07-17T10:00:00.000Z",
    lastError: null
  },
  scheduler: {
    scan: { status: "success", started_at: "2026-07-17T10:00:00.000Z" },
    reminders: { status: "success", started_at: "2026-07-17T09:00:00.000Z" },
    "email-alerts": { status: "success", started_at: "2026-07-17T09:30:00.000Z" }
  },
  deployment: {
    commit: "abc123",
    branch: "main",
    environment: "production",
    url: "https://deal-hunter-ai.vercel.app"
  }
};

describe("production release gates", () => {
  it("declares release ready only when every blocking gate passes", () => {
    const result = evaluateProductionGates(healthy);
    expect(result.releaseReady).toBe(true);
    expect(result.verdict).toBe("ready");
    expect(result.summary.blockingFailures).toBe(0);
  });

  it("blocks release when Telegram or eBay proof is missing", () => {
    const result = evaluateProductionGates({
      ...healthy,
      telegram: { ...healthy.telegram, webhookMatches: false },
      ebay: { ...healthy.ebay, successes: 0, candidates: 0 }
    });
    expect(result.releaseReady).toBe(false);
    expect(result.summary.blockingFailures).toBe(2);
    expect(result.gates.find((item) => item.id === "telegram-webhook")?.status).toBe("fail");
    expect(result.gates.find((item) => item.id === "ebay")?.status).toBe("fail");
  });

  it("keeps optional schedulers as warnings instead of release blockers", () => {
    const result = evaluateProductionGates({
      ...healthy,
      scheduler: {
        scan: healthy.scheduler.scan
      }
    });
    expect(result.releaseReady).toBe(true);
    expect(result.summary.warnings).toBe(2);
  });
});
