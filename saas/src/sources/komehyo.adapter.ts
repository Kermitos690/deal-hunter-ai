import type { ConditionGrade, ProductCandidate, SourceAdapter } from "@/types";
import { inferRadarBrand } from "./ebay.adapter";

const BASE_URL = "https://komehyo.jp";
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "ja,en-US;q=0.9,en;q=0.8"
};

function decodeHtml(value: string) {
  const entities: Record<string, string> = {
    "&amp;": "&", "&quot;": "\"", "&#39;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " "
  };
  return value
    .replace(/&(amp|quot|#39|lt|gt|nbsp);/g, (entity) => entities[entity] ?? entity)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function komehyoConditionGrade(value: string): ConditionGrade {
  if (/新品/.test(value)) return "NEW";
  if (/未使用|中古品Ｓ|中古品S|中古品Ａ|中古品A/.test(value)) return "A";
  if (/中古品Ｂ|中古品B/.test(value)) return "B";
  if (/中古品Ｃ|中古品C/.test(value)) return "C";
  return "UNKNOWN";
}

export function parseKomehyoHtml(
  html: string,
  context: { brands: string[]; models: string[]; category: string }
): ProductCandidate[] {
  return html
    .split(/<li class="p-lists__item">/)
    .slice(1)
    .flatMap((block): ProductCandidate[] => {
      const path = block.match(/class="p-link p-link--card" href="([^"]+)"/)?.[1];
      const id = block.match(/name="goodsNo" value="([^"]+)"/)?.[1]
        ?? path?.match(/\/product\/([^/]+)/)?.[1];
      const titleRaw = block.match(/p-link__txt--productsname">([\s\S]*?)<\/span>/)?.[1]
        ?? block.match(/<img[^>]+alt="([^"]+)"/)?.[1];
      const priceRaw = block.match(/p-link__txt--price[^>]*>￥([\d,]+)/)?.[1];
      if (!path || !id || !titleRaw || !priceRaw) return [];
      const title = decodeHtml(titleRaw);
      const displayedBrand = decodeHtml(
        block.match(/p-link__txt--brand">([\s\S]*?)<\/span>/)?.[1] ?? ""
      );
      const price = Number(priceRaw.replaceAll(",", ""));
      if (!Number.isFinite(price) || price <= 0) return [];
      const rank = decodeHtml(block.match(/p-link__txt--rank">([\s\S]*?)<\/span>\s*<\/span>/)?.[1] ?? "");
      const image = block.match(/data-src="(https:\/\/img\.komehyo\.jp\/[^"]+)"/)?.[1]
        ?? block.match(/<img src="(https:\/\/img\.komehyo\.jp\/contents\/images\/goods\/[^"]+)"/)?.[1];
      const model = context.models.find((item) =>
        title.toLocaleLowerCase().includes(item.toLocaleLowerCase())
      ) ?? title.match(/\b[A-Z]?\d{2,}(?:\.\d+){1,6}(?:-[A-Z0-9]+)?\b/i)?.[0];
      return [{
        source: "komehyo",
        sourceItemId: String(id),
        title,
        brand: inferRadarBrand(`${title} ${displayedBrand}`, context.brands)
          ?? (context.brands.length === 1 ? context.brands[0] : undefined),
        model,
        category: context.category,
        priceAmount: price,
        priceCurrency: "JPY",
        buyNowPrice: price,
        saleType: "BUY_NOW",
        conditionText: rank || undefined,
        conditionGrade: komehyoConditionGrade(rank),
        sellerName: "KOMEHYO",
        sellerRating: "Professional retailer",
        sellerCountry: "JP",
        itemCountry: "JP",
        productUrl: new URL(path, BASE_URL).toString(),
        imageUrls: image ? [image] : [],
        rawPayload: { rank, marketplace: "KOMEHYO Japan", listingType: "ACTIVE_LISTING" }
      }];
    });
}

export const komehyoAdapter: SourceAdapter = {
  name: "komehyo",
  enabled: process.env.ENABLE_KOMEHYO_SOURCE === "true",
  async scan(radar) {
    if (!this.enabled) return [];
    const queries = radar.brands.length
      ? radar.brands.map((brand) => [brand, ...radar.models, ...radar.include_keywords].filter(Boolean).join(" "))
      : [[...radar.models, ...radar.include_keywords, radar.category].filter(Boolean).join(" ")];
    const results = await Promise.all(queries.slice(0, 6).map(async (query) => {
      try {
        const response = await fetch(`${BASE_URL}/search/?q=${encodeURIComponent(query)}`, {
          headers: BROWSER_HEADERS,
          signal: AbortSignal.timeout(15_000),
          next: { revalidate: 1_800 }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        if (html.length < 1_000) throw new Error("page de blocage");
        return {
          items: parseKomehyoHtml(html, {
            brands: radar.brands,
            models: radar.models,
            category: radar.category
          }),
          error: null
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "erreur inconnue";
        console.warn(`KOMEHYO, requête « ${query} » ignorée: ${message}`);
        return { items: [] as ProductCandidate[], error: message };
      }
    }));
    if (results.every((result) => result.error)) {
      throw new Error(`Toutes les requêtes KOMEHYO ont échoué: ${results.map((result) => result.error).join("; ")}`);
    }
    return [...new Map(results.flatMap((result) => result.items).map((item) => [item.sourceItemId, item])).values()];
  }
};
