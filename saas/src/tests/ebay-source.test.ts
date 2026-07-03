import { describe, expect, it } from "vitest";
import { ebayConditionGrade, inferRadarBrand } from "@/sources/ebay.adapter";

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
});
