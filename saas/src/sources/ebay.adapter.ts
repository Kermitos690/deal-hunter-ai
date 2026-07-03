import type { ProductCandidate, SourceAdapter } from "@/types";

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
    const resultGroups = await Promise.all(searches.flatMap((query) => marketplaces.map(async (marketplace) => {
      const response = await fetch(
        `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&limit=50`,
        { headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": marketplace } }
      );
      if (!response.ok) {
        console.warn(`Recherche eBay ${marketplace}: ${response.status}`);
        return [];
      }
      const body = await response.json();
      return (body.itemSummaries ?? []).map(
      (item: Record<string, any>): ProductCandidate => ({
        source: "ebay",
        sourceItemId: String(item.itemId),
        title: String(item.title),
        priceAmount: Number(item.price?.value ?? 0),
        priceCurrency: String(item.price?.currency ?? "CHF"),
        buyNowPrice: Number(item.price?.value ?? 0),
        shippingCost: Number(item.shippingOptions?.[0]?.shippingCost?.value ?? 0),
        conditionText: item.condition,
        conditionGrade: ebayConditionGrade(item.condition),
        sellerName: item.seller?.username,
        sellerRating: String(item.seller?.feedbackPercentage ?? ""),
        itemCountry: item.itemLocation?.country,
        sellerCountry: item.itemLocation?.country,
        productUrl: String(item.itemWebUrl),
        imageUrls: [item.image?.imageUrl, ...(item.additionalImages ?? []).map((x: any) => x.imageUrl)].filter(Boolean),
        rawPayload: { ...item, marketplace }
      })
    );
    })));
    const results = resultGroups.flat();
    return [...new Map(results.map((item) => [item.sourceItemId, item])).values()];
  }
};
