import type { ProductCandidate, SourceAdapter } from "@/types";

export const yahooJapanAdapter: SourceAdapter = {
  name: "yahoo-japan",
  enabled: process.env.ENABLE_YAHOO_JAPAN_SOURCE === "true" && Boolean(process.env.YAHOO_JAPAN_CLIENT_ID),
  async scan(radar) {
    if (!this.enabled) return [];
    const query = [...radar.brands, ...radar.models, ...radar.include_keywords, radar.category].filter(Boolean).join(" ");
    const url = new URL("https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch");
    url.searchParams.set("appid", process.env.YAHOO_JAPAN_CLIENT_ID!);
    url.searchParams.set("query", query);
    url.searchParams.set("results", "50");
    const response = await fetch(url, { headers: { "user-agent": "DealHunterAI/1.0" } });
    if (!response.ok) throw new Error(`Yahoo Shopping API: ${response.status}`);
    const data = await response.json();
    return (data.hits ?? []).map((item: any): ProductCandidate => ({
      source: "yahoo-japan",
      sourceItemId: String(item.code),
      title: String(item.name),
      brand: item.brand?.name,
      priceAmount: Number(item.price),
      priceCurrency: "JPY",
      buyNowPrice: Number(item.price),
      sellerName: item.seller?.name,
      sellerRating: item.review?.rate ? String(item.review.rate) : undefined,
      sellerCountry: "JP",
      itemCountry: "JP",
      productUrl: String(item.url),
      imageUrls: [item.image?.medium, item.image?.small].filter(Boolean),
      description: item.description,
      conditionGrade: "UNKNOWN",
      rawPayload: item
    }));
  }
};
