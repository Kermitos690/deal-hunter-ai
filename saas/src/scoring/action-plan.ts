import type { MarketConfidence, ProductCandidate, Radar } from "@/types";

export interface DealActionPlan {
  maximumOffer: number;
  breakEvenResalePrice: number;
  recommendedChannel: string;
  estimatedSaleDays: number;
  action: string;
}

const money = (value: number) => Number(Math.max(0, value).toFixed(2));

export function buildDealActionPlan(
  candidate: ProductCandidate,
  radar: Radar,
  resalePrice: number,
  confidence: MarketConfidence
): DealActionPlan {
  const shipping = candidate.shippingCost ?? radar.shipping_cost;
  const fixedCosts = shipping + radar.customs_cost + radar.repair_cost;
  const saleFeeRate = radar.platform_fee_rate + radar.payment_fee_rate;
  const netSaleFactor = Math.max(0.01, 1 - saleFeeRate);
  const vatFactor = 1 + radar.vat_rate;
  const maximumOffer =
    ((resalePrice * netSaleFactor - Math.max(0, radar.min_profit)) / vatFactor) - fixedCosts;
  const currentLandedCost = (candidate.priceAmount + fixedCosts) * vatFactor;
  const breakEvenResalePrice = currentLandedCost / netSaleFactor;
  const category = `${candidate.category ?? radar.category}`.toLowerCase();

  let recommendedChannel = "eBay";
  let estimatedSaleDays = 45;
  if (category.includes("montre")) {
    recommendedChannel = "Chrono24 ou eBay";
    estimatedSaleDays = 35;
  } else if (category.includes("sac") || category.includes("accessoire")) {
    recommendedChannel = "Vestiaire Collective ou eBay";
    estimatedSaleDays = 40;
  } else if (category.includes("collection")) {
    recommendedChannel = "eBay ou maison d’enchères spécialisée";
    estimatedSaleDays = 60;
  }
  if (confidence === "LOW") estimatedSaleDays += 20;
  if (candidate.conditionGrade === "C" || candidate.conditionGrade === "REPAIR") estimatedSaleDays += 20;

  const offer = money(maximumOffer);
  const action = candidate.priceAmount <= offer
    ? `Acheter seulement après les vérifications de risque, sans dépasser ${offer.toFixed(0)} CHF.`
    : `Négocier à ${offer.toFixed(0)} CHF maximum ; au-dessus, la marge cible n’est plus respectée.`;

  return {
    maximumOffer: offer,
    breakEvenResalePrice: money(breakEvenResalePrice),
    recommendedChannel,
    estimatedSaleDays,
    action
  };
}
