import { describe, expect, it } from "vitest";
import { parseRadarSources } from "@/telegram/bot";

describe("Telegram radar sources", () => {
  it("accepte uniquement les sources opérationnelles", () => {
    expect(parseRadarSources("ebay")).toEqual(["ebay"]);
    expect(parseRadarSources("komehyo")).toEqual(["komehyo"]);
    expect(parseRadarSources("tutti")).toEqual(["tutti"]);
    expect(parseRadarSources("tout")).toEqual(["ebay","ricardo","anibis","tutti","komehyo","email-alerts","rss"]);
    expect(parseRadarSources("toutes sauf mock")).toEqual(["ebay","ricardo","anibis","tutti","komehyo","email-alerts","rss"]);
    expect(parseRadarSources("mock")).toBeNull();
    expect(parseRadarSources("source inventée")).toBeNull();
  });
});
