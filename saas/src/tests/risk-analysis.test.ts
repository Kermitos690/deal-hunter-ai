import { describe, expect, it } from "vitest";
import { analyzeRisk } from "@/scoring/analyze-risk";
import type { MarketEstimate, ProductCandidate } from "@/types";

const candidate: ProductCandidate = {
  source: "ebay", sourceItemId: "1", title: "Omega Seamaster",
  brand: "Omega", priceAmount: 600, priceCurrency: "CHF",
  productUrl: "https://example.com", imageUrls: ["1"], conditionGrade: "B"
};
const market: MarketEstimate = {
  low: 700, median: 850, high: 950, currency: "CHF", confidence: "MEDIUM",
  comparableCount: 4, comparableSources: ["ebay"], notes: [], comparableDetails: []
};

describe("analyzeRisk", () => {
  it("dégrade fortement une annonce suspecte et sans preuves", () => {
    const result = analyzeRisk({
      ...candidate,
      title: "Rolex replica inspired - no return",
      imageUrls: [],
      sellerRating: undefined,
      conditionGrade: "UNKNOWN",
      priceAmount: 50
    }, { ...market, confidence: "LOW", low: 1000 });
    expect(result.level).toBe("CRITICAL");
    expect(result.signals.length).toBeGreaterThan(3);
    expect(result.checks.some((check) => check.includes("authenticité"))).toBe(true);
  });

  it("reste prudent même sans signal critique", () => {
    const result = analyzeRisk({
      ...candidate, imageUrls: ["1", "2", "3"], sellerRating: "99.8%", brand: "Omega"
    }, { ...market, confidence: "HIGH", low: 500 });
    expect(result.level).toBe("LOW");
    expect(result.checks.length).toBeGreaterThan(0);
  });
});
