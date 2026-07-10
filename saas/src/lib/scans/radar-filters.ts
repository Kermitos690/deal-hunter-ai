import { isWatchCategory, looksLikeCompleteWatchTitle, matchesAllSearchTerms, matchesAnySearchTerm } from "@/lib/search-precision";
import type { DealScore, ProductCandidate, Radar } from "@/types";

const EU = new Set(["AT","BE","BG","HR","CY","CZ","DE","DK","EE","ES","FI","FR","GR","HU","IE","IT","LT","LU","LV","MT","NL","PL","PT","RO","SE","SI","SK"]);
const normalized = (value: string) =>
  value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

function textFor(candidate: ProductCandidate) {
  return normalized([
    candidate.title, candidate.brand, candidate.model, candidate.description
  ].filter(Boolean).join(" "));
}

function acceptedCountries(radar: Radar) {
  return radar.source_countries.map((value) => value.toUpperCase());
}

export function estimatedLandedCost(candidate: ProductCandidate, radar: Radar) {
  const subtotal = candidate.priceAmount +
    (candidate.shippingCost ?? radar.shipping_cost) +
    radar.customs_cost +
    radar.repair_cost;
  return subtotal + subtotal * radar.vat_rate;
}

export function radarDiscoveryMode(radar: Radar) {
  return radar.min_profit <= 1;
}

export function effectiveMinScore(radar: Radar) {
  return radarDiscoveryMode(radar) ? 0 : radar.min_score;
}

export function effectiveMinRoiPercent(radar: Radar) {
  return radarDiscoveryMode(radar) ? 0 : radar.min_roi_percent;
}

export function candidateMismatchReasons(candidate: ProductCandidate, radar: Radar) {
  const reasons: string[] = [];
  if (candidate.priceAmount > radar.max_buy_price) reasons.push("price_above_max");
  if (radar.total_budget && estimatedLandedCost(candidate, radar) > radar.total_budget) reasons.push("landed_cost_above_budget");
  if (radar.photos_required && candidate.imageUrls.length === 0) reasons.push("missing_photos");
  if (!radar.accepted_conditions.includes(candidate.conditionGrade ?? "UNKNOWN")) reasons.push("condition_not_accepted");

  const text = textFor(candidate);
  if (isWatchCategory(radar.category) && !looksLikeCompleteWatchTitle(candidate.title, [...radar.brands, ...radar.models])) {
    reasons.push("not_complete_watch");
  }
  if (radar.brands.length && !matchesAnySearchTerm(text, radar.brands)) reasons.push("brand_not_matched");
  if (radar.models.length && !matchesAnySearchTerm(text, radar.models)) reasons.push("model_not_matched");
  if (radar.include_keywords.length && !matchesAllSearchTerms(text, radar.include_keywords)) reasons.push("keyword_not_matched");
  if (radar.exclude_keywords.length && matchesAnySearchTerm(text, radar.exclude_keywords)) reasons.push("excluded_keyword");

  const country = candidate.itemCountry?.toUpperCase();
  if (country && radar.source_countries.length) {
    const accepted = acceptedCountries(radar);
    if (!accepted.includes(country) && !(accepted.includes("EU") && EU.has(country))) reasons.push("country_not_accepted");
  }
  if (candidate.saleType && radar.sale_types.length && !radar.sale_types.includes(candidate.saleType)) reasons.push("sale_type_not_accepted");
  return reasons;
}

export function candidateMatchesRadar(candidate: ProductCandidate, radar: Radar) {
  return candidateMismatchReasons(candidate, radar).length === 0;
}

export function scoreMismatchReasons(score: DealScore, radar: Radar) {
  const reasons: string[] = [];
  if (score.totalScore < effectiveMinScore(radar)) reasons.push("score_too_low");
  if (score.estimatedNetProfit < Math.max(0, radar.min_profit)) reasons.push("profit_too_low");
  if (score.estimatedNetProfit < 0) reasons.push("negative_profit");
  if (score.estimatedRoiPercent < effectiveMinRoiPercent(radar)) reasons.push("roi_too_low");
  return reasons;
}

export function scoreMatchesRadar(score: DealScore, radar: Radar) {
  return scoreMismatchReasons(score, radar).length === 0;
}
