import { describe, expect, it } from "vitest";
import { localLiveSourcesForRadar, shouldFallbackToEbay } from "@/lib/scans/run-radar-scan";
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

  it("déclenche le fallback eBay si toutes les sources live choisies échouent", () => {
    expect(shouldFallbackToEbay(["ricardo", "tutti"], [
      { candidates: [], error: "HTTP 403" },
      { candidates: [], error: "HTTP 403" }
    ])).toBe(true);
    expect(shouldFallbackToEbay(["ebay", "ricardo"], [
      { candidates: [], error: "HTTP 403" }
    ])).toBe(false);
    expect(shouldFallbackToEbay(["ricardo", "tutti"], [
      { candidates: [{} as any], error: null },
      { candidates: [], error: "HTTP 403" }
    ])).toBe(false);
  });

  it("sélectionne uniquement les sources live locales supportées", () => {
    expect(localLiveSourcesForRadar(["ebay", "ricardo", "tutti", "komehyo"])).toEqual(["ricardo", "tutti"]);
  });

  it("ignore les radars sans source live locale", () => {
    expect(localLiveSourcesForRadar(["ebay", "komehyo", "email-alerts"])).toEqual([]);
  });
});
