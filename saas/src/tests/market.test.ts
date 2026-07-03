import { describe, expect, it } from "vitest";
import { estimateMarketValue } from "@/market/market-estimator";
import { mockCandidates } from "@/sources/mock.adapter";
import { radar } from "./fixtures";
describe("estimateMarketValue", () => {
  it("n’invente pas de comparables", () => {
    const result=estimateMarketValue(mockCandidates[0],radar,[]);
    expect(result.confidence).toBe("LOW");
    expect(result.comparableSources).toHaveLength(0);
    expect(result.median).toBe(mockCandidates[0].priceAmount);
    expect(result.comparableCount).toBe(0);
    expect(result.notes.join(" ")).toContain("Comparables insuffisants");
  });
});
