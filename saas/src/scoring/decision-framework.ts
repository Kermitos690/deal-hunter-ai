import type { MarketConfidence, Recommendation } from "@/types";

export type EvidenceGrade = "A" | "B" | "C" | "D";
export type DecisionStatus = "APPROVED" | "CONDITIONAL" | "REVIEW_REQUIRED" | "REJECTED";

export interface DecisionFrameworkInput {
  recommendation: Recommendation;
  confidence: MarketConfidence;
  comparableCount: number;
  riskScore: number;
  estimatedNetProfit: number;
}

export function evidenceGrade(
  confidence: MarketConfidence,
  comparableCount: number
): EvidenceGrade {
  if (confidence === "HIGH" && comparableCount >= 10) return "A";
  if (confidence === "MEDIUM" && comparableCount >= 3) return "B";
  if (comparableCount > 0) return "C";
  return "D";
}

export function professionalDecision(input: DecisionFrameworkInput) {
  const grade = evidenceGrade(input.confidence, input.comparableCount);
  let status: DecisionStatus;
  if (input.estimatedNetProfit <= 0 || input.recommendation === "AVOID" || input.riskScore < 30) {
    status = "REJECTED";
  } else if (
    input.recommendation === "BUY" &&
    ["A", "B"].includes(grade) &&
    input.riskScore >= 75
  ) {
    status = "APPROVED";
  } else if (
    ["BUY", "NEGOTIATE"].includes(input.recommendation) &&
    ["A", "B"].includes(grade) &&
    input.riskScore >= 55
  ) {
    status = "CONDITIONAL";
  } else {
    status = "REVIEW_REQUIRED";
  }

  const rationale = status === "APPROVED"
    ? "Critères économiques, niveau de preuve et risque compatibles avec une décision d’achat."
    : status === "CONDITIONAL"
      ? "Opportunité exploitable uniquement si les contrôles et le prix plafond sont respectés."
      : status === "REJECTED"
        ? "Risque, rentabilité ou recommandation incompatibles avec un achat discipliné."
        : "Données insuffisantes pour valider l’achat sans analyse humaine complémentaire.";
  return { evidenceGrade: grade, decisionStatus: status, decisionRationale: rationale };
}

export const decisionLabel: Record<DecisionStatus, string> = {
  APPROVED: "VALIDÉ",
  CONDITIONAL: "SOUS CONDITIONS",
  REVIEW_REQUIRED: "REVUE REQUISE",
  REJECTED: "ÉCARTÉ"
};
