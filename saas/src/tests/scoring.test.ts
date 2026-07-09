import { describe, expect, it } from "vitest";
import { calculateDealScore } from "@/scoring/calculate-deal-score";
import { mockCandidates } from "@/sources/mock.adapter";
import { radar } from "./fixtures";
describe("calculateDealScore", () => {
  it("calcule marge, ROI et verdict borné", () => {
    const result = calculateDealScore(mockCandidates[0], radar, {
      low:250,median:290,high:320,currency:"CHF",confidence:"MEDIUM",
      comparableCount:4,comparableSources:["manual"],notes:[],comparableDetails:[]
    });
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
    expect(result.estimatedNetProfit).toBeGreaterThan(0);
    expect(["BUY","NEGOTIATE","WATCH","AVOID"]).toContain(result.recommendation);
    expect(result.scoringVersion).toBe("v4");
    expect(result.reasons.join(" ")).toContain("Calcul : achat");
    expect(result.reasons.join(" ")).toContain("Preuve");
  });
  it("ne recommande pas un achat avec une confiance faible", () => {
    const result = calculateDealScore(mockCandidates[0], radar, {
      low:400,median:500,high:600,currency:"CHF",confidence:"LOW",
      comparableCount:0,comparableSources:[],notes:[],comparableDetails:[]
    });
    expect(result.totalScore).toBeLessThan(55);
    expect(["WATCH","AVOID"]).toContain(result.recommendation);
    expect(result.warnings.join(" ")).toContain("Confiance marché faible");
  });
});
