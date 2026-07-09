import type { ProductCandidate, SourceAdapter } from "@/types";

const EBAY_PRIORITY_SOURCE_URL = process.env.EBAY_PRIORITY_SOURCE_URL ?? "https://ebay.io/m/bSMD1F";

function searchable(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function inferRadarBrand(title: string, brands: string[]) {
  const normalizedTitle = searchable(title);
  return brands.find((brand) => normalizedTitle.includes(searchable(brand)));
}

export function isRelevantEbayListing(title: string, category: string) {
  const normalizedCategory = searchable(category);
  if (!/(montre|watch|uhr)/.test(normalizedCategory)) return true;
  const value = searchable(title);
  return !/(bracelet|watch band|watch strap|cadran|dial only|boite vide|empty box|manual only|bezel only|movement only)/.test(value);
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
  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Identifiants eBay manquants.");
  const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope"
  });
  if (!response.ok) throw new Error(`OAuth eBay: ${response.status}`);
  return (await response.json()).access_token as string;
}

export function ebayPriorityEnabled() {
  return process.env.ENABLE_EBAY_PRIORITY_SOURCE !== "false";
}

export function ebaySearchUrl(query: string, priority = false) {
  const params = new URLSearchParams({ q: query, limit: "50" });
  if (priority) {
    params.set("sort", "newlyListed");
  }
  return `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`;
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

export const ebayAdapter: SourceAdapter = {
  name: "ebay",
  enabled: process.env.ENABLE_EBAY_SOURCE === "true",
  async scan(radar) {
    if (!this.enabled) return [];
    const token = await accessToken();
    const searches = radar.brands.length
      ? radar.brands.map((brand) => [brand, ...radar.models, ...radar.include_keywords, radar.category].filter(Boolean).join(" "))
      : [[...radar.models, ...radar.include_keywords, radar.category].filter(Boolean).join(" ")];
    const marketplaces = (process.env.EBAY_MARKETPLACES ?? "EBAY_CH,EBAY_FR,EBAY_DE,EBAY_IT,EBAY_GB,EBAY_US")
      .split(",").map((value) => value.trim()).filter(Boolean);
    const searchPlan = [
      ...(ebayPriorityEnabled()
        ? searches.flatMap((query) => priorityMarketplaces(marketplaces).map((marketplace) => ({ query, marketplace, priority: true })))
        : []),
      ...searches.flatMap((query) => marketplaces.map((marketplace) => ({ query, marketplace, priority: false })))
    ];
    const resultGroups = await Promise.all(searchPlan.map(async ({ query, marketplace, priority }) => {
      const response = await fetch(
        ebaySearchUrl(query, priority),
        { headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": marketplace } }
      );
      if (!response.ok) {
        console.warn(`Recherche eBay ${marketplace}${priority ? " prioritaire" : ""}: ${response.status}`);
        return [];
      }
      const body = await response.json();
      return (body.itemSummaries ?? [])
      .filter((item: Record<string, any>) => isRelevantEbayListing(String(item.title), radar.category))
      .map(
      (item: Record<string, any>): ProductCandidate => ({
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
          internalPrioritySourceUrl: priority ? EBAY_PRIORITY_SOURCE_URL : undefined
        }
      })
    );
    }));
    const results = sortPriorityFirst(resultGroups.flat());
    return [...new Map(results.map((item) => [item.sourceItemId, item])).values()];
  }
};
