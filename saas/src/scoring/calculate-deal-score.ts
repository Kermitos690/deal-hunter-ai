import type { DealScore, MarketEstimate, ProductCandidate, Radar } from "@/types";
import { analyzeRisk } from "./analyze-risk";
import { buildDealActionPlan } from "./action-plan";
import { professionalDecision } from "./decision-framework";

const conditionScores = { NEW: 95, A: 88, B: 72, C: 48, REPAIR: 30, UNKNOWN: 35 };
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function evidenceSummary(market: MarketEstimate) {
  const sold = market.comparableDetails.filter((item) => item.evidenceType === "SOLD").length;
  const active = market.comparableDetails.filter((item) => item.evidenceType === "ACTIVE_LISTING").length;
  const signals = market.comparableDetails.filter((item) => item.evidenceType === "MARKET_SIGNAL").length;
  if (!market.comparableCount) return "Preuve D : aucun comparable exploitable.";
  return `Preuve ${market.confidence} : ${sold} vente(s) conclue(s), ${active} annonce(s) active(s), ${signals} signal(aux) marché.`;
}

function costFormula(
  candidate: ProductCandidate,
  radar: Radar,
  shipping: number,
  estimatedBuyCost: number,
  saleFees: number
) {
  const vatPercent = (radar.vat_rate * 100).toFixed(1);
  const feePercent = ((radar.platform_fee_rate + radar.payment_fee_rate) * 100).toFixed(1);
  return `Calcul : achat ${candidate.priceAmount.toFixed(0)} + livraison ${shipping.toFixed(0)} + douane ${radar.customs_cost.toFixed(0)} + réparation ${radar.repair_cost.toFixed(0)} + TVA ${vatPercent}% = coût livré ${estimatedBuyCost.toFixed(0)} CHF ; frais de revente ${feePercent}% ≈ ${saleFees.toFixed(0)} CHF.`;
}

export function calculateDealScore(
  candidate: ProductCandidate,
  radar: Radar,
  market: MarketEstimate
): DealScore {
  const shipping = candidate.shippingCost ?? radar.shipping_cost;
  const subtotal = candidate.priceAmount + shipping + radar.customs_cost + radar.repair_cost;
  const vat = subtotal * radar.vat_rate;
  const estimatedBuyCost = subtotal + vat;
  const saleFees = market.median * (radar.platform_fee_rate + radar.payment_fee_rate);
  const estimatedNetProfit = market.median - saleFees - estimatedBuyCost;
  const roi = estimatedBuyCost > 0 ? (estimatedNetProfit / estimatedBuyCost) * 100 : 0;
  const marginScore = clamp((roi / Math.max(radar.min_roi_percent || 20, 20)) * 70 + 20);

  const knownBrand = Boolean(candidate.brand && candidate.brand.length > 2);
  const liquidityScore = clamp(
    (market.confidence === "HIGH" ? 90 : market.confidence === "MEDIUM" ? 70 : 42) +
      (knownBrand ? 8 : -8)
  );

  const risk = analyzeRisk(candidate, market);
  const warnings = [...risk.signals, ...risk.checks.map((check) => `À vérifier : ${check}`)];
  const riskScore = risk.score;
  const conditionScore = conditionScores[candidate.conditionGrade ?? "UNKNOWN"];

  let urgencyScore = 35;
  if (candidate.auctionEndAt) {
    const hours = (new Date(candidate.auctionEndAt).getTime() - Date.now()) / 3_600_000;
    urgencyScore = clamp(hours <= 1 ? 95 : hours <= 6 ? 75 : hours <= 24 ? 55 : 35);
  } else if (candidate.buyNowPrice) {
    urgencyScore = 55;
  }

  const rawTotalScore = clamp(
    marginScore * 0.4 +
      liquidityScore * 0.2 +
      riskScore * 0.2 +
      conditionScore * 0.12 +
      urgencyScore * 0.08
  );
  const totalScore = market.confidence === "LOW" && market.comparableCount < 8
    ? Math.min(rawTotalScore, 54)
    : rawTotalScore;
  const recommendation =
    totalScore >= 85
      ? "BUY"
      : totalScore >= 70
        ? "NEGOTIATE"
        : totalScore >= 50 && estimatedNetProfit > 0
          ? "WATCH"
          : "AVOID";
  const actionPlan = buildDealActionPlan(candidate, radar, market.median, market.confidence);
  const respectsOfferDiscipline = candidate.priceAmount <= actionPlan.maximumOffer;
  const finalRecommendation = !respectsOfferDiscipline && recommendation === "BUY"
    ? "NEGOTIATE"
    : !respectsOfferDiscipline && recommendation === "NEGOTIATE"
      ? "WATCH"
      : recommendation;
  const decision = professionalDecision({
    recommendation: finalRecommendation,
    confidence: market.confidence,
    comparableCount: market.comparableCount,
    riskScore,
    estimatedNetProfit
  });
  const reasons = [
    estimatedNetProfit > 0
      ? `Marge nette estimée à ${estimatedNetProfit.toFixed(0)} CHF.`
      : "Marge nette négative.",
    `ROI estimé à ${roi.toFixed(1)} %.`,
    market.confidence !== "LOW"
      ? "Estimation soutenue par des comparables."
      : market.comparableCount >= 8
        ? "Estimation basée sur plusieurs signaux actifs, à confirmer par ventes conclues."
        : "Estimation de marché prudente.",
    evidenceSummary(market),
    costFormula(candidate, radar, shipping, estimatedBuyCost, saleFees)
  ];
  if (conditionScore >= 70) reasons.push("État compatible avec une revente standard.");
  if (!respectsOfferDiscipline) {
    warnings.push(`Prix actuel supérieur à l’offre maximum calculée (${actionPlan.maximumOffer.toFixed(0)} CHF). Négociation obligatoire.`);
  }
  if (market.confidence === "LOW") {
    warnings.push("Confiance marché faible : ne pas traiter comme un achat automatique.");
  }
  warnings.push(...market.notes.slice(0, 3));

  return {
    totalScore,
    marginScore,
    liquidityScore,
    riskScore,
    conditionScore,
    urgencyScore,
    estimatedBuyCost: Number(estimatedBuyCost.toFixed(2)),
    estimatedResalePrice: market.median,
    estimatedNetProfit: Number(estimatedNetProfit.toFixed(2)),
    estimatedRoiPercent: Number(roi.toFixed(2)),
    maximumOffer: actionPlan.maximumOffer,
    breakEvenResalePrice: actionPlan.breakEvenResalePrice,
    recommendedChannel: actionPlan.recommendedChannel,
    estimatedSaleDays: actionPlan.estimatedSaleDays,
    actionPlan: actionPlan.action,
    evidenceGrade: decision.evidenceGrade,
    decisionStatus: decision.decisionStatus,
    decisionRationale: decision.decisionRationale,
    recommendation: finalRecommendation,
    scoringVersion: "v4",
    marketConfidence: market.confidence,
    comparableCount: market.comparableCount,
    reasons,
    warnings
  };
}
