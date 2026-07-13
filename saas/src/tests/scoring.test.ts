import { describe, expect, it } from "vitest";
import { calculateDealScore } from "@/scoring/calculate-deal-score";
import { mockCandidates } from "@/sources/mock.adapter";
import { radar } from "./fixtures";
import type { ProductCandidate } from "@/types";

describe("calculateDealScore", () => {
  it("calcule marge, ROI et verdict borné", () => {
    const result = calculateDealScore(mockCandidates[0], radar, {
      low: 250,
      median: 290,
      high: 320,
      currency: "CHF",
      confidence: "MEDIUM",
      comparableCount: 4,
      comparableSources: ["manual"],
      notes: [],
      comparableDetails: []
    });
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
    expect(result.estimatedNetProfit).toBeGreaterThan(0);
    expect(["BUY", "NEGOTIATE", "WATCH", "AVOID"]).toContain(result.recommendation);
    expect(result.scoringVersion).toBe("v5");
    expect(result.reasons.join(" ")).toContain("Calcul : achat");
    expect(result.reasons.join(" ")).toContain("Preuve");
  });

  it("ne recommande pas un achat avec une confiance faible", () => {
    const result = calculateDealScore(mockCandidates[0], radar, {
      low: 400,
      median: 500,
      high: 600,
      currency: "CHF",
      confidence: "LOW",
      comparableCount: 0,
      comparableSources: [],
      notes: [],
      comparableDetails: []
    });
    expect(result.totalScore).toBeLessThan(55);
    expect(["WATCH", "AVOID"]).toContain(result.recommendation);
    expect(result.warnings.join(" ")).toContain("Confiance marché faible");
  });

  it("plafonne une annonce à forte apparence de ROI mais marge absolue dérisoire", () => {
    const lowProfitCandidate: ProductCandidate = {
      source: "ebay",
      sourceItemId: "low-profit",
      title: "Pokémon Pikachu card near mint",
      brand: "Pokémon",
      category: "Cartes à collectionner",
      priceAmount: 80,
      priceCurrency: "CHF",
      shippingCost: 0,
      buyNowPrice: 80,
      saleType: "BUY_NOW",
      conditionGrade: "B",
      productUrl: "https://example.test/low-profit",
      imageUrls: ["https://example.test/card.jpg"]
    };
    const result = calculateDealScore(lowProfitCandidate, { ...radar, shipping_cost: 0 }, {
      low: 90,
      median: 96.5,
      high: 110,
      currency: "CHF",
      confidence: "HIGH",
      comparableCount: 12,
      comparableSources: ["sold"],
      notes: [],
      comparableDetails: []
    });
    expect(result.estimatedNetProfit).toBeGreaterThan(0);
    expect(result.estimatedNetProfit).toBeLessThan(10);
    expect(result.totalScore).toBeLessThanOrEqual(39);
    expect(result.recommendation).toBe("AVOID");
    expect(result.warnings.join(" ")).toContain("marge nette absolue est trop faible");
  });
});
