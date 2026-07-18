import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ADMIN_REFILL_CALLBACK,
  formatAdminInboxRefillSummary,
  isAdminInboxRefillUpdate,
  summarizeAdminInboxRefill
} from "@/telegram/admin-inbox-refill";

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}

describe("admin Inbox refill", () => {
  it("recognizes the callback and the admin command", () => {
    expect(isAdminInboxRefillUpdate({
      callback_query: {
        id: "callback-1",
        data: ADMIN_REFILL_CALLBACK,
        from: { id: 123 },
        message: { chat: { id: 123 } }
      }
    })).toBe(true);
    expect(isAdminInboxRefillUpdate({
      message: { text: "/refill", from: { id: 123 }, chat: { id: 123 } }
    })).toBe(true);
    expect(isAdminInboxRefillUpdate({
      message: { text: "/inbox", from: { id: 123 }, chat: { id: 123 } }
    })).toBe(false);
  });

  it("summarizes candidates, unique alerts, skips and failures", () => {
    const summary = summarizeAdminInboxRefill([
      {
        id: "r1",
        name: "Radar 1",
        ok: true,
        candidatesFound: 12,
        alertsCreated: 3,
        rejectionSummary: { already_seen: 6, below_min_score: 3 }
      },
      {
        id: "r2",
        name: "Radar 2",
        ok: true,
        skipped: true,
        reason: "radar_locked",
        candidatesFound: 0,
        alertsCreated: 0
      },
      { id: "r3", name: "Radar 3", ok: false, error: "source error" }
    ], 7);

    expect(summary.requestedRadars).toBe(3);
    expect(summary.completedRadars).toBe(1);
    expect(summary.skippedRadars).toBe(1);
    expect(summary.failedRadars).toBe(1);
    expect(summary.candidatesFound).toBe(12);
    expect(summary.alertsCreated).toBe(3);
    expect(summary.filteredCandidates).toBe(9);
    expect(summary.inboxCount).toBe(7);
    expect(formatAdminInboxRefillSummary(summary)).toContain("3 nouveau(x) deal(s) unique(s)");
  });

  it("keeps the action admin-only and schedules it after the webhook response", () => {
    const service = read("src/telegram/admin-inbox-refill.ts");
    const webhook = read("src/app/api/telegram/webhook/route.ts");
    const menu = read("src/telegram/menu.ts");

    expect(service).toContain("request.telegramId !== process.env.ADMIN_TELEGRAM_ID");
    expect(service).toContain("runRadarScan(radar.id, user.id, { updateRadarSchedule: false })");
    expect(service).toContain('.update({ status: "inbox" })');
    expect(webhook).toContain("after(() => runAdminInboxRefill(refill))");
    expect(webhook).toContain("export const maxDuration = 300");
    expect(menu).toContain("Remplir l’Inbox (admin)");
  });
});
