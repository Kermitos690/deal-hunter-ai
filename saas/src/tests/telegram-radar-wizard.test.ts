import { describe,expect,it } from "vitest";
import { parseBrands, parseSearchIntent, positiveNumber, recommendedTelegramSources, sourceSelectionKeyboard } from "@/telegram/radar-wizard";

describe("Telegram radar wizard",()=>{
  it("reconnaît plusieurs marques sans virgules",()=>{
    expect(parseBrands("Prada Louis Vuitton FENDI Gucci Hermes")).toEqual(["Prada","Louis Vuitton","Fendi","Gucci","Hermès"]);
    expect(parseBrands("Omega TAG Heuer Rolex Tissot")).toEqual(["Omega","TAG Heuer","Rolex","Tissot"]);
  });
  it("structure précisément une recherche Rolex libre",()=>{
    expect(parseSearchIntent("Je cherche une Rolex Daytona 116500LN", "Montres")).toEqual(expect.objectContaining({
      brands: ["Rolex"],
      models: ["Daytona"],
      includeKeywords: ["116500LN"]
    }));
    expect(parseSearchIntent("Rolex GMT Master 2 Coca-Cola ou Cola ou Pepsi", "Montres")).toEqual(expect.objectContaining({
      brands: ["Rolex"],
      models: ["GMT-Master II"],
      includeKeywords: ["Pepsi|Coke"]
    }));
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
  it("affine les mots écrits à la main sans exiger de virgules",()=>{
    const watch = parseSearchIntent("Omega Seamaster 136.005 révisée full set cuir", "Montres");
    expect(watch.brands).toContain("Omega");
    expect(watch.models).toContain("Seamaster");
    expect(watch.includeKeywords).toEqual(expect.arrayContaining(["136.005", "révision", "full set", "cuir"]));

    const sneaker = parseSearchIntent("Nike SB Dunk taille 42 OG box worn once", "Sneakers");
    expect(sneaker.brands).toContain("Nike");
    expect(sneaker.models).toEqual(["SB Dunk"]);
    expect(sneaker.includeKeywords).toEqual(expect.arrayContaining(["42", "OG box", "worn once"]));
  });
});
