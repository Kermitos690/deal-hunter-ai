import { describe, expect, it } from "vitest";
import { estimateMarketValue } from "@/market/market-estimator";
import { mockCandidates } from "@/sources/mock.adapter";
import { radar } from "./fixtures";

describe("estimateMarketValue", () => {
  it("n’invente pas de comparables", () => {
    const result = estimateMarketValue(mockCandidates[0], radar, []);
    expect(result.confidence).toBe("LOW");
    expect(result.comparableSources).toHaveLength(0);
    expect(result.median).toBe(mockCandidates[0].priceAmount);
    expect(result.comparableCount).toBe(0);
    expect(result.notes.join(" ")).toContain("Comparables suffisamment proches indisponibles");
  });

  it("privilégie les ventes récentes et écarte les annonces trop éloignées", () => {
    const now = Date.now();
    const result = estimateMarketValue(mockCandidates[0], radar, [
      ...Array.from({ length: 5 }, (_, index) => ({
        sold_price: 900 + index * 10,
        currency: mockCandidates[0].priceCurrency,
        source: "auction_house",
        evidence_type: "SOLD" as const,
        confidence: "HIGH" as const,
        sold_at: new Date(now - index * 86_400_000).toISOString(),
        match_score: 1
      })),
      {
        sold_price: 4000,
        currency: mockCandidates[0].priceCurrency,
        source: "ebay_active_listing",
        evidence_type: "ACTIVE_LISTING" as const,
        confidence: "LOW" as const,
        match_score: 0.5
      }
    ]);
    expect(result.median).toBeLessThan(1000);
    expect(result.confidence).toBe("MEDIUM");
    expect(result.notes.join(" ")).toContain("5 vente(s) réalisée(s)");
    expect(result.comparableDetails).toHaveLength(5);
    expect(result.comparableDetails.every((item) => item.evidenceType === "SOLD")).toBe(true);
    expect(result.comparableDetails[0].weight).toBeGreaterThan(0);
  });
});
