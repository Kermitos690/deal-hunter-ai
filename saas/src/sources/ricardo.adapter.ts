import type { ConditionGrade, ProductCandidate, Radar, SourceAdapter } from "@/types";
import { inferRadarBrand } from "./ebay.adapter";
import { fetchErrorMessage, liveFetch } from "./live-http";

const BASE_URL = "https://www.ricardo.ch";
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "fr-CH,fr;q=0.9,en;q=0.8"
};
const INACTIVE_RE = /l.article a ete vendu|l.article a été vendu|article vendu|vendu pour|n.est plus disponible|vente terminée|enchère terminée|auction ended|sold/i;
const ACTIVE_RE = /achat direct|enchérir|prix d'achat direct|prix de départ|ajouter aux favoris|protection\+/i;

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

function normalized(value: string) {
  return decodeHtml(value).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function parsePrice(value: string) {
  const match = value.match(/(?:CHF|Fr\.?|prix[^\d]{0,30}|>)([\d'’.,\s]{2,})(?:\s*(?:CHF|\.-|Fr\.?))?/i);
  if (!match) return null;
  const parsed = Number(match[1].replace(/[\s'’]/g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function conditionGrade(value: string): ConditionGrade {
  const text = normalized(value);
  if (/neuf|new|jamais porte/.test(text)) return "NEW";
  if (/comme neuf|excellent|tres bon|très bon/.test(text)) return "A";
  if (/occasion|d.occasion|utilise|used|bon etat|bon état/.test(text)) return "B";
  if (/acceptable|usage|usure|poor|fair/.test(text)) return "C";
  if (/defectueux|defekt|pour pieces|not working|reparation/.test(text)) return "REPAIR";
  return "UNKNOWN";
}

function titleFrom(html: string) {
  return decodeHtml(
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      ?? html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1]
      ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      ?? "Annonce Ricardo"
  ).replace(/\s+\|\s+Ricardo.*$/i, "");
}

function imageUrlsFrom(html: string) {
  return [...new Set([
    ...Array.from(html.matchAll(/<meta property="og:image" content="([^"]+)"/gi)).map((match) => match[1]),
    ...Array.from(html.matchAll(/https:\/\/[^"'\s]+(?:ricardo|ricardostatic|cloudfront)[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi)).map((match) => match[0])
  ])].slice(0, 10);
}

function saleTypeFrom(html: string): "BUY_NOW" | "AUCTION" {
  return /enchérir|prix de départ|bid/i.test(html) ? "AUCTION" : "BUY_NOW";
}

function detailLinks(html: string) {
  return [...new Set(Array.from(html.matchAll(/href="([^"]*\/fr\/a\/[^"?#]+\d+\/?)"/g))
    .map((match) => new URL(match[1], BASE_URL).toString()))]
    .slice(0, 20);
}

async function detailCandidate(url: string, radar: Radar): Promise<ProductCandidate | null> {
  const response = await liveFetch(url, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(12_000),
    next: { revalidate: 900 }
  });
  if (!response.ok) return null;
  const html = await response.text();
  if (INACTIVE_RE.test(normalized(html)) || !ACTIVE_RE.test(normalized(html))) return null;
  const title = titleFrom(html);
  const price = parsePrice(html);
  if (!price) return null;
  const id = url.match(/-(\d+)\/?$/)?.[1] ?? url;
  const saleType = saleTypeFrom(html);
  const shipping = parsePrice(html.match(/Livraison[\s\S]{0,400}/i)?.[0] ?? "") ?? undefined;
  return {
    source: "ricardo",
    sourceItemId: id,
    title,
    brand: inferRadarBrand(title, radar.brands),
    category: radar.category,
    priceAmount: price,
    priceCurrency: "CHF",
    buyNowPrice: saleType === "BUY_NOW" ? price : undefined,
    currentBidPrice: saleType === "AUCTION" ? price : undefined,
    saleType,
    shippingCost: shipping,
    conditionText: decodeHtml(html.match(/État[\s\S]{0,160}/i)?.[0] ?? ""),
    conditionGrade: conditionGrade(html),
    sellerCountry: "CH",
    itemCountry: "CH",
    productUrl: url,
    imageUrls: imageUrlsFrom(html),
    description: decodeHtml(html.match(/<meta name="description" content="([^"]+)"/i)?.[1] ?? ""),
    rawPayload: { marketplace: "Ricardo Switzerland", activeVerified: true }
  };
}

export const ricardoAdapter: SourceAdapter = {
  name: "ricardo",
  enabled: process.env.ENABLE_RICARDO_SOURCE === "true",
  async scan(radar) {
    if (!this.enabled) return [];
    const queries = radar.brands.length
      ? radar.brands.map((brand) => [brand, ...radar.models, ...radar.include_keywords, radar.category].filter(Boolean).join(" "))
      : [[...radar.models, ...radar.include_keywords, radar.category].filter(Boolean).join(" ")];
    const results = await Promise.all(queries.slice(0, 6).map(async (query) => {
      try {
        const response = await liveFetch(`${BASE_URL}/fr/s/${encodeURIComponent(query)}/`, {
          headers: BROWSER_HEADERS,
          signal: AbortSignal.timeout(12_000),
          next: { revalidate: 900 }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        const links = detailLinks(html);
        const items = await Promise.all(links.map((url) => detailCandidate(url, radar)));
        return { items: items.filter((item): item is ProductCandidate => Boolean(item)), error: null };
      } catch (error) {
        const message = fetchErrorMessage(error);
        console.warn(`Ricardo, requête « ${query} » ignorée: ${message}`);
        return { items: [] as ProductCandidate[], error: message };
      }
    }));
    if (results.every((result) => result.error)) {
      throw new Error(`Toutes les requêtes Ricardo ont échoué: ${results.map((result) => result.error).join("; ")}`);
    }
    return [...new Map(results.flatMap((result) => result.items).map((item) => [item.sourceItemId, item])).values()];
  }
};
