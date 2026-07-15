import { afterEach, describe, expect, it } from "vitest";
import {
  ebayConditionGrade,
  ebayEndUserContextHeader,
  ebayPriorityEnabled,
  ebayPrioritySellers,
  ebayPrioritySourceUrls,
  ebaySearchQueries,
  ebaySearchUrl,
  inferRadarBrand,
  isAuthenticityOrientedEbayTitle,
  isRelevantEbayListing
} from "@/sources/ebay.adapter";

const watchRadar = {
  brands: ["Rolex"],
  models: ["GMT-Master II"],
  include_keywords: ["Pepsi"],
  category: "Montres"
};

describe("source eBay", () => {
  afterEach(() => {
    delete process.env.ENABLE_EBAY_PRIORITY_SOURCE;
    delete process.env.EBAY_DELIVERY_COUNTRY;
    delete process.env.EBAY_PRIORITY_SOURCE_URLS;
    delete process.env.EBAY_PRIORITY_SELLERS;
  });

  it("normalise les états eBay", () => {
    expect(ebayConditionGrade("New with tags")).toBe("NEW");
    expect(ebayConditionGrade("Pre-owned - Good")).toBe("B");
    expect(ebayConditionGrade("For parts or not working")).toBe("REPAIR");
  });

  it("déduit la marque du titre sans dépendre des accents", () => {
    expect(inferRadarBrand("Montre OMEGA Seamaster vintage", ["Oméga", "TAG Heuer"]))
      .toBe("Oméga");
  });

  it("écarte les accessoires et catalogues d’un radar de montres", () => {
    expect(isRelevantEbayListing("Cadran Omega Seamaster ancien", watchRadar, ["Omega", "Seamaster"])).toBe(false);
    expect(isRelevantEbayListing("Rolex Daytona stainless steel bracelet 78360", watchRadar, ["Rolex", "Daytona"])).toBe(false);
    expect(isRelevantEbayListing("Rolex catalogue watches 2024", watchRadar, ["Rolex"])).toBe(false);
    expect(isRelevantEbayListing("Montre Omega Seamaster automatique", watchRadar, ["Omega", "Seamaster"])).toBe(true);
    expect(isRelevantEbayListing("Rolex GMT-Master II 126710BLRO Pepsi full set", watchRadar, ["Rolex", "GMT-Master II"])).toBe(true);
  });

  it("génère des requêtes précises et conserve les alias experts", () => {
    const queries = ebaySearchQueries(watchRadar);
    expect(queries).toContain("Rolex GMT-Master II Pepsi watch");
    expect(queries.some((query) => query.toLowerCase().includes("blro"))).toBe(true);
    expect(queries.some((query) => query.toLowerCase().endsWith("watch"))).toBe(true);
  });

  it("garde la passe prioritaire désactivée par défaut", () => {
    expect(ebayPriorityEnabled()).toBe(false);
    process.env.ENABLE_EBAY_PRIORITY_SOURCE = "true";
    expect(ebayPriorityEnabled()).toBe(true);
  });

  it("prépare une recherche eBay prioritaire interne sans créer de source visible", () => {
    process.env.ENABLE_EBAY_PRIORITY_SOURCE = "true";
    expect(ebaySearchUrl("Seiko vintage watch")).toContain("q=Seiko+vintage+watch");
    expect(ebaySearchUrl("Seiko vintage watch", true)).toContain("sort=newlyListed");
    expect(ebaySearchUrl("Seiko vintage watch", { priority: true, sellers: ["tatsuen", "akiakiehgsjusov"] }))
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
