import type { MarketEstimate, ProductCandidate, Radar } from "@/types";

export interface Comparable {
  sold_price: number;
  currency: string;
  source: string;
  sold_at?: string | null;
  evidence_type?: "SOLD" | "ACTIVE_LISTING" | "MARKET_SIGNAL";
  confidence?: "LOW" | "MEDIUM" | "HIGH";
  condition_grade?: string | null;
  match_score?: number | null;
  title?: string | null;
  brand?: string | null;
  model?: string | null;
  evidence_url?: string | null;
}

const DAY = 86_400_000;

const normalized = (value: unknown) => String(value ?? "")
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, " ")
  .trim();

function isWatchCandidate(candidate: ProductCandidate) {
  return /montre|watch|horlog/i.test(`${candidate.category ?? ""} ${candidate.title ?? ""}`);
}

function watchReferenceTokens(value: unknown) {
  return [...new Set(
    normalized(value)
      .match(/\b(?=[a-z0-9-]{4,12}\b)(?=[a-z0-9-]*\d{2})[a-z0-9]+(?:-[a-z0-9]+)?\b/g)
      ?.filter((token) => !/^\d{2,4}(?:mm|cm|m|h|jewels?)$/.test(token))
      .filter((token) => !/^(?:automatic|quartz|vintage|watch|wrist)$/.test(token))
      ?? []
  )];
}

function effectiveMatchScore(item: Comparable, candidate: ProductCandidate) {
  const watch = isWatchCandidate(candidate);
  const stated = Number(item.match_score);
  let score = Number.isFinite(stated) ? stated : watch ? 0.45 : 0.6;

  const candidateModel = normalized(candidate.model);
  const itemModel = normalized(item.model);
  if (candidateModel && itemModel && candidateModel !== itemModel) score = Math.min(score, 0.4);

  if (watch) {
    const candidateRefs = watchReferenceTokens(`${candidate.title ?? ""} ${candidate.model ?? ""}`);
    const itemRefs = watchReferenceTokens(`${item.title ?? ""} ${item.model ?? ""}`);
    if (candidateRefs.length && itemRefs.length) {
      const shared = candidateRefs.some((reference) => itemRefs.includes(reference));
      if (!shared) return 0;
      score = Math.max(score, 0.85);
    }
  }

  return Math.max(0, Math.min(1, score));
}

export function comparableWeight(item: Comparable, candidate: ProductCandidate, now: number) {
  const kind = item.evidence_type ?? (item.source.endsWith("_active_listing") ? "ACTIVE_LISTING" : "SOLD");
  const evidenceWeight = kind === "SOLD" ? 1 : kind === "MARKET_SIGNAL" ? 0.45 : 0.2;
  const confidenceWeight = item.confidence === "HIGH" ? 1 : item.confidence === "MEDIUM" ? 0.8 : 0.6;
  const ageDays = item.sold_at
    ? Math.max(0, (now - new Date(item.sold_at).getTime()) / DAY)
    : kind === "SOLD" ? 365 : 30;
  const recencyWeight = kind === "SOLD" ? Math.exp(-ageDays / 180) : 0.7;
  const conditionWeight =
    item.condition_grade && candidate.conditionGrade && item.condition_grade !== candidate.conditionGrade
      ? 0.7
      : 1;
  return evidenceWeight * confidenceWeight * recencyWeight * conditionWeight *
    Math.max(0.2, Math.min(1, item.match_score ?? 0.75));
}

function weightedQuantile(values: Array<{ price: number; weight: number }>, quantile: number) {
  const ordered = [...values].sort((a, b) => a.price - b.price);
  const target = ordered.reduce((sum, item) => sum + item.weight, 0) * quantile;
  let cumulative = 0;
  for (const item of ordered) {
    cumulative += item.weight;
    if (cumulative >= target) return item.price;
  }
  return ordered.at(-1)?.price ?? 0;
}

function evidenceKind(item: Comparable) {
  return item.evidence_type ?? (item.source.endsWith("_active_listing") ? "ACTIVE_LISTING" : "SOLD");
}

export function estimateMarketValue(
  candidate: ProductCandidate,
  _radar: Radar,
  comparables: Comparable[] = []
): MarketEstimate {
  const now = Date.now();
  const minimumMatch = isWatchCandidate(candidate) ? 0.7 : 0.6;
  const valid = comparables
    .filter((item) => item.currency === candidate.priceCurrency && item.sold_price > 0)
    .filter((item) => !item.sold_at || Number.isFinite(new Date(item.sold_at).getTime()))
    .map((item) => ({ ...item, match_score: effectiveMatchScore(item, candidate) }))
    .filter((item) => Number(item.match_score ?? 0) >= minimumMatch)
    .map((item) => ({ item, price: item.sold_price, weight: comparableWeight(item, candidate, now) }))
    .filter((item) => item.weight > 0)
    .sort((a, b) => a.price - b.price);
  if (valid.length) {
    const trim = valid.length >= 10 ? Math.floor(valid.length * 0.1) : 0;
    const sample = trim ? valid.slice(trim, valid.length - trim) : valid;
    const sold = sample.filter(({ item }) => evidenceKind(item) === "SOLD");
    const activeSignals = sample.filter(({ item }) => evidenceKind(item) !== "SOLD");
    const soldSources = new Set(sold.map(({ item }) => item.source));
    const recentSold = sold.filter(({ item }) =>
      item.sold_at && now - new Date(item.sold_at).getTime() <= 90 * DAY
    );
    const median = weightedQuantile(sample, 0.5);
    const low = weightedQuantile(sample, 0.25);
    const high = weightedQuantile(sample, 0.75);
    const confidence =
      sold.length >= 10 && recentSold.length >= 5 && soldSources.size >= 2
        ? "HIGH"
        : sold.length >= 3 || (sold.length >= 1 && activeSignals.length >= 5)
          ? "MEDIUM"
          : "LOW";
    return {
      low,
      median,
      high,
      currency: candidate.priceCurrency,
      confidence,
      comparableCount: sample.length,
      comparableSources: [...new Set(sample.map(({ item }) => item.source))],
      notes: [
        `${sold.length} vente(s) réalisée(s), dont ${recentSold.length} sur les 90 derniers jours.`,
        `${activeSignals.length} annonce(s) active(s) ou signal(aux) de marché suffisamment proches, pondérés à la baisse.`,
        sold.length ? "Estimation soutenue par au moins une vente réalisée." : "Aucune vente conclue exploitable : estimation indicative uniquement, achat automatique interdit.",
        `Comparables sous ${Math.round(minimumMatch * 100)} % de correspondance exclus du calcul.`
      ],
      comparableDetails: sample.map(({ item, weight }) => ({
        source: item.source,
        evidenceType: evidenceKind(item),
        title: item.title,
        price: item.sold_price,
        currency: item.currency,
        soldAt: item.sold_at,
        conditionGrade: item.condition_grade,
        brand: item.brand,
        model: item.model,
        evidenceUrl: item.evidence_url,
        confidence: item.confidence,
        matchScore: item.match_score ?? 0,
        weight: Number(weight.toFixed(4))
      }))
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
      "Comparables suffisamment proches indisponibles.",
      "Aucune hausse de revente n’est supposée sans données de marché vérifiables."
    ],
    comparableDetails: []
  };
}
