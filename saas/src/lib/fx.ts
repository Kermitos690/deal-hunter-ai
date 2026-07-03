import type { ProductCandidate } from "@/types";

const cache = new Map<string, { rate: number; expires: number }>();

export async function rateToChf(currency: string) {
  const base = currency.toUpperCase();
  if (base === "CHF") return 1;
  const cached = cache.get(base);
  if (cached && cached.expires > Date.now()) return cached.rate;
  const response = await fetch(
    `https://api.frankfurter.dev/v2/rate/${encodeURIComponent(base)}/CHF`,
    { next: { revalidate: 43_200 } }
  );
  if (!response.ok) throw new Error(`Taux ${base}/CHF indisponible.`);
  const data = await response.json();
  const rate = Number(data.rate);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error(`Taux ${base}/CHF invalide.`);
  cache.set(base, { rate, expires: Date.now() + 43_200_000 });
  return rate;
}

export async function candidateInChf(candidate: ProductCandidate): Promise<ProductCandidate> {
  const rate = await rateToChf(candidate.priceCurrency);
  if (rate === 1) return candidate;
  return {
    ...candidate,
    priceAmount: Number((candidate.priceAmount * rate).toFixed(2)),
    buyNowPrice: candidate.buyNowPrice == null ? undefined : Number((candidate.buyNowPrice * rate).toFixed(2)),
    currentBidPrice: candidate.currentBidPrice == null ? undefined : Number((candidate.currentBidPrice * rate).toFixed(2)),
    shippingCost: candidate.shippingCost == null ? undefined : Number((candidate.shippingCost * rate).toFixed(2)),
    priceCurrency: "CHF",
    rawPayload: { ...candidate.rawPayload, originalCurrency: candidate.priceCurrency, fxRateToChf: rate }
  };
}
