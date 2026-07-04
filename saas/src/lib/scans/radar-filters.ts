import type { DealScore, ProductCandidate, Radar } from "@/types";

const EU = new Set(["AT","BE","BG","HR","CY","CZ","DE","DK","EE","ES","FI","FR","GR","HU","IE","IT","LT","LU","LV","MT","NL","PL","PT","RO","SE","SI","SK"]);
const normalized = (value: string) =>
  value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

function textFor(candidate: ProductCandidate) {
  return normalized([
    candidate.title, candidate.brand, candidate.model, candidate.description
  ].filter(Boolean).join(" "));
}

export function estimatedLandedCost(candidate: ProductCandidate, radar: Radar) {
  const subtotal = candidate.priceAmount +
    (candidate.shippingCost ?? radar.shipping_cost) +
    radar.customs_cost +
    radar.repair_cost;
  return subtotal + subtotal * radar.vat_rate;
}

export function candidateMatchesRadar(candidate: ProductCandidate, radar: Radar) {
  if (candidate.priceAmount > radar.max_buy_price) return false;
  if (radar.total_budget && estimatedLandedCost(candidate, radar) > radar.total_budget) return false;
  if (radar.photos_required && candidate.imageUrls.length === 0) return false;
  if (!radar.accepted_conditions.includes(candidate.conditionGrade ?? "UNKNOWN")) return false;

  const text = textFor(candidate);
  if (radar.brands.length && !radar.brands.some((value) => text.includes(normalized(value)))) return false;
  if (radar.models.length && !radar.models.some((value) => text.includes(normalized(value)))) return false;
  if (radar.include_keywords.length && !radar.include_keywords.some((value) => text.includes(normalized(value)))) return false;
  if (radar.exclude_keywords.some((value) => text.includes(normalized(value)))) return false;

  const country = candidate.itemCountry?.toUpperCase();
  if (country && radar.source_countries.length) {
    const accepted = radar.source_countries.map((value) => value.toUpperCase());
    if (!accepted.includes(country) && !(accepted.includes("EU") && EU.has(country))) return false;
  }
  if (candidate.saleType && radar.sale_types.length && !radar.sale_types.includes(candidate.saleType)) return false;
  return true;
}

export function scoreMatchesRadar(score: DealScore, radar: Radar) {
  return score.totalScore >= radar.min_score &&
    score.estimatedNetProfit >= Math.max(0, radar.min_profit) &&
    score.estimatedNetProfit >= 0 &&
    score.estimatedRoiPercent >= radar.min_roi_percent;
}
