import { describe, expect, it } from "vitest";
import { lockIsExpired, SCAN_LOCK_TTL_SECONDS, userCanRunActivity } from "@/lib/scans/scan-policy";

describe("scan policy", () => {
  it("autorise uniquement un utilisateur actif", () => {
    expect(userCanRunActivity("active")).toBe(true);
    expect(userCanRunActivity("suspended")).toBe(false);
    expect(userCanRunActivity(null)).toBe(false);
  });

  it("considère un verrou ancien ou invalide comme expiré", () => {
    const now = Date.parse("2026-07-04T12:00:00Z");
    expect(lockIsExpired("2026-07-04T11:59:59Z", now)).toBe(true);
    expect(lockIsExpired("2026-07-04T12:00:01Z", now)).toBe(false);
    expect(lockIsExpired("date-invalide", now)).toBe(true);
    expect(SCAN_LOCK_TTL_SECONDS).toBe(900);
  });
});
