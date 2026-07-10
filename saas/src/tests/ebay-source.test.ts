import { describe, expect, it } from "vitest";
import {
  ebayConditionGrade,
  ebayEndUserContextHeader,
  ebayPriorityEnabled,
  ebayPrioritySellers,
  ebayPrioritySourceUrls,
  ebaySearchUrl,
  inferRadarBrand,
  isAuthenticityOrientedEbayTitle,
  isRelevantEbayListing
} from "@/sources/ebay.adapter";

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
    expect(ebaySearchUrl("Seiko vintage Montres", { priority: true, sellers: ["tatsuen", "akiakiehgsjusov"] }))
      .toContain("sellers%3A%7Btatsuen%7Cakiakiehgsjusov%7D");
    expect(ebayEndUserContextHeader()).toBe("contextualLocation=country%3DCH");
    expect(ebayPrioritySourceUrls()).toEqual(expect.arrayContaining(["https://ebay.io/m/bSMD1F", "https://ebay.io/m/TDQwZC"]));
    expect(ebayPrioritySellers()).toEqual(expect.arrayContaining(["akiakiehgsjusov", "tatsuen", "brandstreettokyo"]));
  });

  it("écarte les annonces eBay prioritaires qui annoncent clairement une copie", () => {
    expect(isAuthenticityOrientedEbayTitle("Rolex Submariner authentic vintage")).toBe(true);
    expect(isAuthenticityOrientedEbayTitle("Rolex style replica aftermarket custom dial")).toBe(false);
  });
});
