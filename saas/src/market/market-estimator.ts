import type { MarketEstimate, ProductCandidate, Radar } from "@/types";

export interface Comparable {
  sold_price: number;
  currency: string;
  source: string;
}

export function estimateMarketValue(
  candidate: ProductCandidate,
  _radar: Radar,
  comparables: Comparable[] = []
): MarketEstimate {
  const valid = comparables
    .filter((item) => item.currency === candidate.priceCurrency && item.sold_price > 0)
    .map((item) => item.sold_price)
    .sort((a, b) => a - b);
  if (valid.length) {
    const median = valid[Math.floor(valid.length / 2)];
    return {
      low: valid[0],
      median,
      high: valid[valid.length - 1],
      currency: candidate.priceCurrency,
      confidence: valid.length >= 5 ? "HIGH" : valid.length >= 2 ? "MEDIUM" : "LOW",
      comparableSources: [...new Set(comparables.map((item) => item.source))],
      notes: [`${valid.length} comparable(s) manuel(s) ou vérifié(s).`]
    };
  }

  const multipliers: Record<string, number> = {
    NEW: 1.45,
    A: 1.4,
    B: 1.55,
    C: 1.7,
    REPAIR: 2.0,
    UNKNOWN: 1.35
  };
  const median = Math.round(
    candidate.priceAmount * multipliers[candidate.conditionGrade ?? "UNKNOWN"]
  );
  return {
    low: Math.round(median * 0.8),
    median,
    high: Math.round(median * 1.2),
    currency: candidate.priceCurrency,
    confidence: "LOW",
    comparableSources: [],
    notes: [
      "Comparables insuffisants.",
      "Estimation par règle interne : vérifier des ventes réelles avant achat."
    ]
  };
}
