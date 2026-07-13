import { isWatchCategory, looksLikeCompleteWatchTitle, searchTermAlternatives } from "@/lib/search-precision";
import type { ProductCandidate, Radar, SourceAdapter } from "@/types";

const DEFAULT_EBAY_PRIORITY_SOURCE_URLS = [
  "https://ebay.io/m/bSMD1F",
  "https://ebay.io/m/TDQwZC"
];

const DEFAULT_EBAY_PRIORITY_SELLERS = [
  "akiakiehgsjusov",
  "tatsuen",
  "brandstreettokyo"
];

type EbaySearchOptions = {
  priority?: boolean;
  sellers?: string[];
};

type EbaySearchPlanItem = {
  query: string;
  marketplace: string;
  priority: boolean;
  sellers: string[];
};

type EbaySearchResult = {
  items: ProductCandidate[];
  error: string | null;
};

let cachedAccessToken: { value: string; expiresAt: number } | null = null;

function searchable(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function listFromEnv(value?: string) {
  return (value ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
}

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.map((value) => value.trim()).filter((value) => {
    const key = searchable(value);
    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function boundedInteger(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)));
}

function requestTimeoutMs() {
  return boundedInteger(process.env.EBAY_REQUEST_TIMEOUT_MS, 10_000, 2_000, 30_000);
}

function requestConcurrency() {
  return boundedInteger(process.env.EBAY_REQUEST_CONCURRENCY, 4, 1, 10);
}

function maximumRequestsPerScan() {
  return boundedInteger(process.env.EBAY_MAX_REQUESTS_PER_SCAN, 48, 1, 120);
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function runWorker() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()));
  return results;
}

function errorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "TimeoutError") return "timeout";
  return error instanceof Error ? error.message : "erreur inconnue";
}

export function inferRadarBrand(title: string, brands: string[]) {
  const normalizedTitle = searchable(title);
  return brands.find((brand) => normalizedTitle.includes(searchable(brand)));
}

export function isRelevantEbayListing(title: string, category: string, expectedTerms: string[] = []) {
  if (!isWatchCategory(category)) return true;
  return looksLikeCompleteWatchTitle(title, expectedTerms);
}

export function ebayConditionGrade(condition?: string) {
  const value = (condition ?? "").toLowerCase();
  if (/(parts|repair|not working|pour pièces|defekt)/.test(value)) return "REPAIR";
  if (/(new|neuf|neu|nuovo)/.test(value)) return "NEW";
  if (/(very good|excellent|comme neuf|sehr gut)/.test(value)) return "A";
  if (/(good|used|pre-owned|occasion|gebraucht)/.test(value)) return "B";
  if (/(acceptable|fair|poor|usé)/.test(value)) return "C";
  return "UNKNOWN";
}

async function accessToken() {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.value;
  }

  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Identifiants eBay manquants.");
  const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
    signal: AbortSignal.timeout(requestTimeoutMs()),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`OAuth eBay: HTTP ${response.status}`);
  const body = await response.json() as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("OAuth eBay: jeton absent.");
  cachedAccessToken = {
    value: body.access_token,
    expiresAt: Date.now() + Math.max(60, Number(body.expires_in ?? 7_200)) * 1_000
  };
  return body.access_token;
}

export function ebayPriorityEnabled() {
  return process.env.ENABLE_EBAY_PRIORITY_SOURCE === "true";
}

export function ebayPrioritySourceUrls() {
  const configured = listFromEnv(process.env.EBAY_PRIORITY_SOURCE_URLS);
  const legacy = listFromEnv(process.env.EBAY_PRIORITY_SOURCE_URL);
  return [...new Set([...(configured.length ? configured : DEFAULT_EBAY_PRIORITY_SOURCE_URLS), ...legacy])];
}

export function ebayPrioritySellers() {
  const configured = listFromEnv(process.env.EBAY_PRIORITY_SELLERS);
  return configured.length ? configured : DEFAULT_EBAY_PRIORITY_SELLERS;
}

export function isAuthenticityOrientedEbayTitle(title: string) {
  const value = searchable(title);
  return !/(replica|fake|faux|counterfeit|style only|homage|aftermarket|compatible|custom dial|parts only|not genuine)/.test(value);
}

export function ebayEndUserContextHeader() {
  const country = (process.env.EBAY_DELIVERY_COUNTRY ?? "CH").trim().toUpperCase();
  return `contextualLocation=${encodeURIComponent(`country=${country}`)}`;
}

export function ebaySearchUrl(query: string, options: boolean | EbaySearchOptions = false) {
  const normalizedOptions = typeof options === "boolean" ? { priority: options } : options;
  const params = new URLSearchParams({ q: query, limit: "50" });
  if (normalizedOptions.priority) {
    params.set("sort", "newlyListed");
  }
  if (normalizedOptions.sellers?.length) {
    params.set("filter", `sellers:{${normalizedOptions.sellers.join("|")}}`);
  }
  return `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`;
}

function keywordCombinations(keywords: string[], limit = 12) {
  if (!keywords.length) return [[]] as string[][];
  let combinations: string[][] = [[]];
  for (const keyword of keywords) {
    const alternatives = searchTermAlternatives(keyword).slice(0, 4);
    const next: string[][] = [];
    for (const combination of combinations) {
      for (const alternative of alternatives.length ? alternatives : [keyword]) {
        next.push([...combination, alternative]);
        if (next.length >= limit) break;
      }
      if (next.length >= limit) break;
    }
    combinations = next;
    if (combinations.length >= limit) combinations = combinations.slice(0, limit);
  }
  return combinations;
}

export function ebaySearchQueries(radar: Pick<Radar, "brands" | "models" | "include_keywords" | "category">) {
  const brands = radar.brands.length ? radar.brands : [""];
  const models = radar.models.length ? radar.models : [""];
  const categoryHint = isWatchCategory(radar.category) ? "watch" : radar.category;
  const keywordVariants = keywordCombinations(radar.include_keywords);
  const queries: string[] = [];

  for (const brand of brands) {
    for (const model of models) {
      for (const keywords of keywordVariants) {
        queries.push([brand, model, ...keywords, categoryHint].filter(Boolean).join(" "));
        if (queries.length >= 16) return unique(queries);
      }
    }
  }
  return unique(queries);
}

function priorityMarketplaces(marketplaces: string[]) {
  const configured = (process.env.EBAY_PRIORITY_MARKETPLACES ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  const preferred = configured.length ? configured : ["EBAY_CH", "EBAY_US", "EBAY_GB", "EBAY_DE"];
  const selected = marketplaces.filter((marketplace) => preferred.includes(marketplace));
  return selected.length ? selected : marketplaces.slice(0, 2);
}

function sortPriorityFirst(items: ProductCandidate[]) {
  return items.sort((a, b) => Number(Boolean(b.rawPayload?.internalPriorityEbaySource)) - Number(Boolean(a.rawPayload?.internalPriorityEbaySource)));
}

function isPriorityJapanCandidate(item: Record<string, any>) {
  const country = String(item.itemLocation?.country ?? "").toUpperCase();
  const japanOnly = process.env.EBAY_PRIORITY_JAPAN_ONLY !== "false";
  if (japanOnly && country && country !== "JP" && country !== "JAPAN") return false;
  return isAuthenticityOrientedEbayTitle(String(item.title ?? ""));
}

export const ebayAdapter: SourceAdapter = {
  name: "ebay",
  enabled: process.env.ENABLE_EBAY_SOURCE === "true",
  async scan(radar) {
    if (!this.enabled) return [];
    const token = await accessToken();
    const searches = ebaySearchQueries(radar);
    const marketplaces = (process.env.EBAY_MARKETPLACES ?? "EBAY_CH,EBAY_FR,EBAY_DE,EBAY_IT,EBAY_GB,EBAY_US")
      .split(",").map((value) => value.trim()).filter(Boolean);
    const prioritySellers = ebayPrioritySellers();
    const prioritySourceUrls = ebayPrioritySourceUrls();
    const priorityPlan: EbaySearchPlanItem[] = ebayPriorityEnabled()
      ? searches.flatMap((query) => priorityMarketplaces(marketplaces).flatMap((marketplace) => [
        ...(prioritySellers.length ? [{ query, marketplace, priority: true, sellers: prioritySellers }] : []),
        { query, marketplace, priority: true, sellers: [] }
      ]))
      : [];
    const regularPlan: EbaySearchPlanItem[] = searches.flatMap((query) =>
      marketplaces.map((marketplace) => ({ query, marketplace, priority: false, sellers: [] }))
    );
    const searchPlan = [...priorityPlan, ...regularPlan].slice(0, maximumRequestsPerScan());
    const expectedTerms = [...radar.brands, ...radar.models, ...radar.include_keywords];

    const resultGroups = await mapWithConcurrency(searchPlan, requestConcurrency(), async ({ query, marketplace, priority, sellers }): Promise<EbaySearchResult> => {
      try {
        const response = await fetch(
          ebaySearchUrl(query, { priority, sellers }),
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "X-EBAY-C-MARKETPLACE-ID": marketplace,
              "X-EBAY-C-ENDUSERCTX": ebayEndUserContextHeader()
            },
            signal: AbortSignal.timeout(requestTimeoutMs()),
            cache: "no-store"
          }
        );
        if (!response.ok) {
          return { items: [], error: `HTTP ${response.status}` };
        }
        const body = await response.json();
        const items = (body.itemSummaries ?? [])
          .filter((item: Record<string, any>) => isRelevantEbayListing(String(item.title), radar.category, expectedTerms))
          .filter((item: Record<string, any>) => !priority || !sellers.length || isPriorityJapanCandidate(item))
          .map((item: Record<string, any>): ProductCandidate => ({
            source: "ebay",
            sourceItemId: String(item.itemId),
            title: String(item.title),
            brand: inferRadarBrand(String(item.title), radar.brands),
            category: radar.category,
            priceAmount: Number(item.price?.value ?? 0),
            priceCurrency: String(item.price?.currency ?? "CHF"),
            buyNowPrice: Number(item.price?.value ?? 0),
            currentBidPrice: item.buyingOptions?.includes("AUCTION") ? Number(item.currentBidPrice?.value ?? item.price?.value ?? 0) : undefined,
            saleType: item.buyingOptions?.includes("AUCTION") ? "AUCTION" : "BUY_NOW",
            auctionEndAt: item.buyingOptions?.includes("AUCTION") ? item.itemEndDate : undefined,
            shippingCost: Number(item.shippingOptions?.[0]?.shippingCost?.value ?? 0),
            conditionText: item.condition,
            conditionGrade: ebayConditionGrade(item.condition),
            sellerName: item.seller?.username,
            sellerRating: String(item.seller?.feedbackPercentage ?? ""),
            itemCountry: item.itemLocation?.country,
            sellerCountry: item.itemLocation?.country,
            productUrl: String(item.itemWebUrl),
            imageUrls: [item.image?.imageUrl, ...(item.additionalImages ?? []).map((x: any) => x.imageUrl)].filter(Boolean),
            rawPayload: {
              ...item,
              marketplace,
              internalPriorityEbaySource: priority,
              internalPrioritySellers: sellers,
              internalPrioritySourceUrls: priority ? prioritySourceUrls : undefined,
              internalPriorityDeliveryCountry: process.env.EBAY_DELIVERY_COUNTRY ?? "CH",
              internalPriorityAuthenticityOriented: priority && isAuthenticityOrientedEbayTitle(String(item.title ?? "")),
              internalSearchQuery: query
            }
          }));
        return { items, error: null };
      } catch (error) {
        return { items: [], error: errorMessage(error) };
      }
    });

    const successfulRequests = resultGroups.filter((result) => !result.error);
    if (!successfulRequests.length) {
      const errors = [...new Set(resultGroups.map((result) => result.error).filter(Boolean))].slice(0, 5);
      throw new Error(`Toutes les requêtes eBay ont échoué: ${errors.join("; ") || "erreur inconnue"}`);
    }

    const results = sortPriorityFirst(resultGroups.flatMap((result) => result.items));
    return [...new Map(results.map((item) => [item.sourceItemId, item])).values()];
  }
};
