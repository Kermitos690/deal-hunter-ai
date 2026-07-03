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
    const trim = valid.length >= 10 ? Math.floor(valid.length * 0.1) : 0;
    const sample = trim ? valid.slice(trim, valid.length - trim) : valid;
    const median = sample[Math.floor(sample.length / 2)];
    const low = sample[Math.floor((sample.length - 1) * 0.25)];
    const high = sample[Math.floor((sample.length - 1) * 0.75)];
    return {
      low,
      median,
      high,
      currency: candidate.priceCurrency,
      confidence: sample.length >= 10 ? "HIGH" : sample.length >= 3 ? "MEDIUM" : "LOW",
      comparableCount: sample.length,
      comparableSources: [...new Set(comparables.map((item) => item.source))],
      notes: [`${sample.length} comparable(s), valeurs extrêmes écartées.`]
    };
  }

  const median = candidate.priceAmount;
  return {
    low: median,
    median,
    high: median,
    currency: candidate.priceCurrency,
    confidence: "LOW",
    comparableCount: 0,
    comparableSources: [],
    notes: [
      "Comparables insuffisants.",
      "Aucune hausse de revente n’est supposée sans données de marché."
    ]
  };
}
