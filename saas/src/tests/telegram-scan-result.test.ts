import { describe, expect, it } from "vitest";
import { scanResultText } from "@/telegram/bot";

describe("scanResultText", () => {
  it("résume les annonces analysées et alertes envoyées", () => {
    const text = scanResultText({ candidatesFound: 816, alertsSent: 9 });
    expect(text).toContain("816 annonce(s)");
    expect(text).toContain("9 opportunité(s)");
  });

  it("explique un verrou concurrent", () => {
    expect(scanResultText({
      candidatesFound: 0, alertsSent: 0, skipped: true, reason: "radar_locked"
    })).toContain("déjà en cours");
  });
});
