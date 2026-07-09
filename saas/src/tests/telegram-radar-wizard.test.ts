import { describe,expect,it } from "vitest";
import { parseBrands, positiveNumber, recommendedTelegramSources, sourceSelectionKeyboard } from "@/telegram/radar-wizard";

describe("Telegram radar wizard",()=>{
  it("reconnaît plusieurs marques sans virgules",()=>{
    expect(parseBrands("Prada Louis Vuitton FENDI Gucci Hermes")).toEqual(["Prada","Louis Vuitton","Fendi","Gucci","Hermès"]);
    expect(parseBrands("Omega TAG Heuer Rolex Tissot")).toEqual(["Omega","TAG Heuer","Rolex","Tissot"]);
  });
  it("conserve une marque inconnue et accepte les montants suisses",()=>{
    expect(parseBrands("Marque artisanale")).toEqual(["Marque artisanale"]);
    expect(positiveNumber("1'500")).toBe(1500);
    expect(positiveNumber("-2")).toBeNull();
    expect(positiveNumber("abc")).toBeNull();
  });
  it("propose un pack source recommandé sans Ricardo/Anibis par défaut",()=>{
    expect(recommendedTelegramSources()).toEqual(["ebay","komehyo","tutti","email-alerts"]);
    const keyboard = sourceSelectionKeyboard(["ebay","tutti"]);
    expect(JSON.stringify(keyboard)).toContain("✅ 🌍 eBay mondial");
    expect(JSON.stringify(keyboard)).toContain("⬜ 🇨🇭 Ricardo bêta");
    expect(JSON.stringify(keyboard)).toContain("wizsrcdone");
  });
});
