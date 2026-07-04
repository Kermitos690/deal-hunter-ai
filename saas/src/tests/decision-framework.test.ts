import { describe, expect, it } from "vitest";
import { evidenceGrade, professionalDecision } from "@/scoring/decision-framework";

describe("professional decision framework", () => {
  it("classe le niveau de preuve sans surpromettre", () => {
    expect(evidenceGrade("HIGH", 12)).toBe("A");
    expect(evidenceGrade("MEDIUM", 4)).toBe("B");
    expect(evidenceGrade("LOW", 2)).toBe("C");
    expect(evidenceGrade("LOW", 0)).toBe("D");
  });

  it("interdit une validation avec des preuves faibles", () => {
    expect(professionalDecision({
      recommendation: "BUY", confidence: "LOW", comparableCount: 1,
      riskScore: 90, estimatedNetProfit: 500
    }).decisionStatus).toBe("REVIEW_REQUIRED");
  });

  it("valide uniquement une opportunité rentable, documentée et peu risquée", () => {
    expect(professionalDecision({
      recommendation: "BUY", confidence: "HIGH", comparableCount: 12,
      riskScore: 85, estimatedNetProfit: 500
    }).decisionStatus).toBe("APPROVED");
    expect(professionalDecision({
      recommendation: "BUY", confidence: "HIGH", comparableCount: 12,
      riskScore: 20, estimatedNetProfit: 500
    }).decisionStatus).toBe("REJECTED");
  });
});
