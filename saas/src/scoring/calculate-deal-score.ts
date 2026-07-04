import type { DealScore, MarketEstimate, ProductCandidate, Radar } from "@/types";
import { analyzeRisk } from "./analyze-risk";
import { buildDealActionPlan } from "./action-plan";
import { professionalDecision } from "./decision-framework";

const conditionScores = { NEW: 95, A: 88, B: 72, C: 48, REPAIR: 30, UNKNOWN: 35 };
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

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
  const totalScore = market.confidence === "LOW"
    ? Math.min(rawTotalScore, 54)
    : rawTotalScore;
  const recommendation =
    totalScore >= 85
      ? "BUY"
      : totalScore >= 70
        ? "NEGOTIATE"
        : totalScore >= 55
          ? "WATCH"
          : "AVOID";
  const actionPlan = buildDealActionPlan(candidate, radar, market.median, market.confidence);
  const decision = professionalDecision({
    recommendation,
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
      : "Estimation de marché prudente."
  ];
  if (conditionScore >= 70) reasons.push("État compatible avec une revente standard.");

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
    recommendation,
    scoringVersion: "v2",
    marketConfidence: market.confidence,
    comparableCount: market.comparableCount,
    reasons,
    warnings
  };
}
