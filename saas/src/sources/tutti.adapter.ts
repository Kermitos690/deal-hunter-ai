import type { ConditionGrade, ProductCandidate, Radar, SourceAdapter } from "@/types";
import { inferRadarBrand } from "./ebay.adapter";

const BASE_URL = "https://www.tutti.ch";
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "fr-CH,fr;q=0.9,de-CH;q=0.8,it-CH;q=0.7,en;q=0.6"
};

const INACTIVE_RE = /annonce supprim(?:e|é)e|annonce expir(?:e|é)e|n.est plus disponible|déjà vendu|deja vendu|\bvendu\b|\bsold\b|not available|gelöscht|abgelaufen|verkauft/i;
const ACTIVE_RE = /tutti\.ch|mark as favorite|annonc(?:e|es)|contacter|kontakt|message|prix|preis|chf|\.-/i;

function decodeHtml(value: string) {
  const entities: Record<string, string> = {
    "&amp;": "&", "&quot;": "\"", "&#39;": "'", "&#x27;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " "
  };
  return value
    .replace(/&(amp|quot|#39|#x27|lt|gt|nbsp);/g, (entity) => entities[entity] ?? entity)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalized(value: string) {
  return decodeHtml(value).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function parsePrice(value: string) {
  const match = value.match(/(?:CHF|Fr\.?|>|\s)([\d'’.,\s]{1,})(?:\s*(?:CHF|Fr\.?|\.-))/i)
    ?? value.match(/<span[^>]*>([\d'’.,\s]+)\.-<\/span>/i);
  if (!match) return null;
  const parsed = Number(match[1].replace(/[\s'’]/g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function conditionGrade(value: string): ConditionGrade {
  const text = normalized(value);
  if (/neuf|nouveau|new|ungetragen|jamais porte/.test(text)) return "NEW";
  if (/excellent|comme neuf|tres bon|très bon|sehr gut|neuwertig/.test(text)) return "A";
  if (/occasion|bon etat|bon état|gebraucht|utilise|getragen/.test(text)) return "B";
  if (/usage|usure|acceptable|mauvais|spuren/.test(text)) return "C";
  if (/defectueux|pour pieces|reparation|defekt|reparatur/.test(text)) return "REPAIR";
  return "UNKNOWN";
}

function titleFrom(html: string) {
  return decodeHtml(
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      ?? html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1]
      ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      ?? "Annonce Tutti"
  ).replace(/\s+(Canton|Kanton|Cantone)\s+.*$/i, "").replace(/\s+-\s+tutti\.ch.*$/i, "");
}

function descriptionFrom(html: string) {
  return decodeHtml(
    html.match(/<meta name="description" content="([^"]+)"/i)?.[1]
      ?? html.match(/<meta property="og:description" content="([^"]+)"/i)?.[1]
      ?? ""
  );
}

function imageUrlsFrom(html: string) {
  return [...new Set([
    ...Array.from(html.matchAll(/<meta property="og:image(?::secure_url)?" content="([^"]+)"/gi)).map((match) => match[1]),
    ...Array.from(html.matchAll(/https?:\/\/c\.tutti\.ch\/(?:big|thumbnail)\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi)).map((match) => match[0])
  ])]
    .map((url) => url.replace(/^http:\/\//i, "https://"))
    .filter((url) => !/placeholder|empty|data:image/i.test(url))
    .slice(0, 10);
}

function detailLinks(html: string) {
  return [...new Set(Array.from(html.matchAll(/href="([^"]*\/fr\/vi\/[^"?#]+\/\d+)"/g))
    .map((match) => new URL(match[1], BASE_URL).toString()))]
    .slice(0, 24);
}

async function detailCandidate(url: string, radar: Radar): Promise<ProductCandidate | null> {
  const response = await fetch(url, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(12_000),
    next: { revalidate: 900 }
  });
  if (!response.ok) return null;
  const html = await response.text();
  const text = normalized(html);
  if (INACTIVE_RE.test(text) || !ACTIVE_RE.test(text)) return null;
  const price = parsePrice(html);
  if (!price) return null;
  const title = titleFrom(html);
  const id = url.match(/\/(\d+)\/?$/)?.[1] ?? url;
  return {
    source: "tutti",
    sourceItemId: id,
    title,
    brand: inferRadarBrand(title, radar.brands),
    category: radar.category,
    priceAmount: price,
    priceCurrency: "CHF",
    buyNowPrice: price,
    saleType: "BUY_NOW",
    conditionText: decodeHtml(html.match(/(?:État|Zustand|Condizione)[\s\S]{0,180}/i)?.[0] ?? ""),
    conditionGrade: conditionGrade(html),
    sellerCountry: "CH",
    itemCountry: "CH",
    productUrl: url,
    imageUrls: imageUrlsFrom(html),
    description: descriptionFrom(html),
    rawPayload: { marketplace: "Tutti Switzerland", activeVerified: true, availabilityEvidence: "detail_page_price_and_no_inactive_marker" }
  };
}

export const tuttiAdapter: SourceAdapter = {
  name: "tutti",
  enabled: process.env.ENABLE_TUTTI_SOURCE !== "false",
  async scan(radar) {
    if (!this.enabled) return [];
    const queries = radar.brands.length
      ? radar.brands.map((brand) => [brand, ...radar.models, ...radar.include_keywords, radar.category].filter(Boolean).join(" "))
      : [[...radar.models, ...radar.include_keywords, radar.category].filter(Boolean).join(" ")];
    const results = await Promise.all(queries.slice(0, 6).map(async (query) => {
      try {
        const response = await fetch(`${BASE_URL}/fr/q?query=${encodeURIComponent(query)}`, {
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
        const message = error instanceof Error ? error.message : "erreur inconnue";
        console.warn(`Tutti, requête « ${query} » ignorée: ${message}`);
        return { items: [] as ProductCandidate[], error: message };
      }
    }));
    if (results.every((result) => result.error)) {
      throw new Error(`Toutes les requêtes Tutti ont échoué: ${results.map((result) => result.error).join("; ")}`);
    }
    return [...new Map(results.flatMap((result) => result.items).map((item) => [item.sourceItemId, item])).values()];
  }
};
