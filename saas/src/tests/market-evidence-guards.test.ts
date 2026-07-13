import { describe, expect, it } from "vitest";
import { estimateMarketValue } from "@/market/market-estimator";
import { calculateDealScore } from "@/scoring/calculate-deal-score";
import { radar as baseRadar } from "./fixtures";
import type { ProductCandidate, Radar } from "@/types";

const radar: Radar = {
  ...baseRadar,
  category: "Montres",
  brands: ["Seiko"],
  accepted_conditions: ["NEW", "A", "B", "C", "REPAIR", "UNKNOWN"],
  source_countries: [],
  sale_types: ["BUY_NOW", "AUCTION"],
  max_buy_price: 3000,
  min_profit: 1,
  min_roi_percent: 0,
  min_score: 70,
  shipping_cost: 0,
  photos_required: false
};

const candidate: ProductCandidate = {
  source: "ebay",
  sourceItemId: "seiko-7009a",
  title: "Vintage Seiko 5 Purple Dial Automatic Movement No. 7009A Men Wrist Watch",
  brand: "Seiko",
  category: "Montres",
  priceAmount: 52,
  priceCurrency: "CHF",
  conditionGrade: "A",
  productUrl: "https://example.com/seiko-7009a",
  imageUrls: ["https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg"]
};

describe("market evidence guards", () => {
  it("rejette les références de montre incompatibles même si la marque est identique", () => {
    const market = estimateMarketValue(candidate, radar, [
      {
        source: "ebay_active_listing",
        evidence_type: "ACTIVE_LISTING",
        title: "Seiko 5 Automatic 7S26 vintage watch",
        sold_price: 100,
        currency: "CHF",
        match_score: 0.9
      },
      {
        source: "ebay_active_listing",
        evidence_type: "ACTIVE_LISTING",
        title: "Vintage Seiko Quartz 7812-5069 men's watch",
        sold_price: 120,
        currency: "CHF",
        match_score: 0.9
      }
    ]);

    expect(market.comparableCount).toBe(0);
    expect(market.confidence).toBe("LOW");
    expect(market.median).toBe(52);
  });

  it("interdit BUY et plafonne le score sans vente conclue", () => {
    const market = estimateMarketValue(candidate, radar, Array.from({ length: 20 }, (_, index) => ({
      source: "ebay_active_listing",
      evidence_type: "ACTIVE_LISTING" as const,
      title: `Seiko 7009A active listing ${index}`,
      sold_price: 100 + index,
      currency: "CHF",
      match_score: 0.9
    })));
    const score = calculateDealScore(candidate, radar, market);

    expect(market.confidence).toBe("LOW");
    expect(score.totalScore).toBeLessThanOrEqual(64);
    expect(score.recommendation).not.toBe("BUY");
    expect(score.recommendation).not.toBe("NEGOTIATE");
    expect(score.warnings.join(" ")).toContain("Aucune vente conclue");
    expect(score.scoringVersion).toBe("v6");
  });
});
