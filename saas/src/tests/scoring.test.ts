import { describe, expect, it } from "vitest";
import { calculateDealScore } from "@/scoring/calculate-deal-score";
import { mockCandidates } from "@/sources/mock.adapter";
import { radar } from "./fixtures";
describe("calculateDealScore", () => {
  it("calcule marge, ROI et verdict borné", () => {
    const result = calculateDealScore(mockCandidates[0], radar, {
      low:250,median:290,high:320,currency:"CHF",confidence:"MEDIUM",
      comparableSources:["manual"],notes:[]
    });
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
    expect(result.estimatedNetProfit).toBeGreaterThan(0);
    expect(["BUY","NEGOTIATE","WATCH","AVOID"]).toContain(result.recommendation);
  });
});
