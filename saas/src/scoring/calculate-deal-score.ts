import type { DealScore, MarketEstimate, ProductCandidate, Radar } from "@/types";

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

  const warnings: string[] = [];
  let safety = 80;
  if (!candidate.imageUrls.length) {
    safety -= 35;
    warnings.push("Photos insuffisantes : authenticité et état à vérifier.");
  }
  if (!candidate.sellerRating) {
    safety -= 12;
    warnings.push("Réputation vendeur inconnue.");
  }
  if (candidate.priceAmount < market.low * 0.35) {
    safety -= 30;
    warnings.push("Prix anormalement bas : risque d’authenticité élevé.");
  }
  if (market.confidence === "LOW") {
    safety -= 12;
    warnings.push("Comparables insuffisants.");
  }
  const riskScore = clamp(safety);
  const conditionScore = conditionScores[candidate.conditionGrade ?? "UNKNOWN"];

  let urgencyScore = 35;
  if (candidate.auctionEndAt) {
    const hours = (new Date(candidate.auctionEndAt).getTime() - Date.now()) / 3_600_000;
    urgencyScore = clamp(hours <= 1 ? 95 : hours <= 6 ? 75 : hours <= 24 ? 55 : 35);
  } else if (candidate.buyNowPrice) {
    urgencyScore = 55;
  }

  const totalScore = clamp(
    marginScore * 0.4 +
      liquidityScore * 0.2 +
      riskScore * 0.2 +
      conditionScore * 0.12 +
      urgencyScore * 0.08
  );
  const recommendation =
    totalScore >= 85
      ? "BUY"
      : totalScore >= 70
        ? "NEGOTIATE"
        : totalScore >= 55
          ? "WATCH"
          : "AVOID";
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
    recommendation,
    reasons,
    warnings
  };
}
