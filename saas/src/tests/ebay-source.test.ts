import { describe, expect, it } from "vitest";
import { ebayConditionGrade, ebayPriorityEnabled, ebaySearchUrl, inferRadarBrand, isRelevantEbayListing } from "@/sources/ebay.adapter";

describe("source eBay", () => {
  it("normalise les états eBay", () => {
    expect(ebayConditionGrade("New with tags")).toBe("NEW");
    expect(ebayConditionGrade("Pre-owned - Good")).toBe("B");
    expect(ebayConditionGrade("For parts or not working")).toBe("REPAIR");
  });

  it("déduit la marque du titre sans dépendre des accents", () => {
    expect(inferRadarBrand("Montre OMEGA Seamaster vintage", ["Oméga", "TAG Heuer"]))
      .toBe("Oméga");
  });

  it("écarte les accessoires d’un radar de montres", () => {
    expect(isRelevantEbayListing("Cadran Omega Seamaster ancien", "Montres")).toBe(false);
    expect(isRelevantEbayListing("Montre Omega Seamaster automatique", "Montres")).toBe(true);
  });

  it("prépare une recherche eBay prioritaire interne sans créer de source visible", () => {
    expect(ebayPriorityEnabled()).toBe(true);
    expect(ebaySearchUrl("Seiko vintage Montres")).toContain("q=Seiko+vintage+Montres");
    expect(ebaySearchUrl("Seiko vintage Montres", true)).toContain("sort=newlyListed");
  });
});
