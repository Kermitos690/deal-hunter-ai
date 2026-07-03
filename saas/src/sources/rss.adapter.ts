import { XMLParser } from "fast-xml-parser";
import type { ProductCandidate, SourceAdapter } from "@/types";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
const list = <T>(value: T | T[] | undefined): T[] => value == null ? [] : Array.isArray(value) ? value : [value];
const text = (value: any) => typeof value === "object" ? value?.["#text"] ?? "" : String(value ?? "");

function feedUrls() {
  return (process.env.PUBLIC_FEED_URLS ?? "").split(",").map((url) => url.trim()).filter(Boolean);
}

function priceFrom(value: string) {
  const match = value.match(/(?:CHF|EUR|USD|GBP|JPY|€|\$|£)\s*([0-9][0-9'.,]*)|([0-9][0-9'.,]*)\s*(CHF|EUR|USD|GBP|JPY|€|\$|£)/i);
  if (!match) return null;
  const amount = Number((match[1] ?? match[2]).replace(/'/g, "").replace(",", "."));
  const symbol = (match[3] ?? value.match(/CHF|EUR|USD|GBP|JPY|€|\$|£/i)?.[0] ?? "CHF").toUpperCase();
  const currency = symbol === "€" ? "EUR" : symbol === "$" ? "USD" : symbol === "£" ? "GBP" : symbol;
  return Number.isFinite(amount) ? { amount, currency } : null;
}

export const rssAdapter: SourceAdapter = {
  name: "rss",
  enabled: process.env.ENABLE_RSS_SOURCE === "true" && feedUrls().length > 0,
  async scan(radar) {
    const results: ProductCandidate[] = [];
    const query = [...radar.brands, ...radar.models, ...radar.include_keywords, radar.category]
      .map((value) => value.toLowerCase()).filter(Boolean);
    for (const url of feedUrls()) {
      const response = await fetch(url, { headers: { "user-agent": "DealHunterAI/1.0 (+feed reader)" } });
      if (!response.ok) continue;
      const document = parser.parse(await response.text());
      const items = [
        ...list(document?.rss?.channel?.item),
        ...list(document?.feed?.entry)
      ];
      for (const item of items) {
        const title = text(item.title);
        const description = text(item.description ?? item.summary ?? item.content);
        const haystack = `${title} ${description}`.toLowerCase();
        if (query.length && !query.some((term) => haystack.includes(term))) continue;
        const price = priceFrom(haystack);
        if (!price) continue;
        const link = typeof item.link === "object" ? item.link.href : text(item.link);
        if (!link?.startsWith("http")) continue;
        const images = [...description.matchAll(/<img[^>]+src=["']([^"']+)/gi)].map((match) => match[1]);
        results.push({
          source: new URL(url).hostname,
          sourceItemId: text(item.guid ?? item.id) || Buffer.from(link).toString("base64url").slice(0, 60),
          title,
          priceAmount: price.amount,
          priceCurrency: price.currency,
          productUrl: link,
          imageUrls: images,
          description,
          conditionGrade: "UNKNOWN",
          rawPayload: { feedUrl: url }
        });
      }
    }
    return results;
  }
};
