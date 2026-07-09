import type { ConditionGrade, ProductCandidate, Radar, SourceAdapter } from "@/types";
import { inferRadarBrand } from "./ebay.adapter";
import { fetchErrorMessage, liveFetch } from "./live-http";

const BASE_URL = "https://www.tutti.ch";
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "fr-CH,fr;q=0.9,de-CH;q=0.8,it-CH;q=0.7,en;q=0.6"
};

const INACTIVE_TITLE_RE = /annonce supprim(?:e|é)e|annonce expir(?:e|é)e|n.est plus disponible|déjà vendu|deja vendu|\bvendu\b|\bsold\b|not available|gelöscht|abgelaufen|verkauft/i;
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

type SearchCard = {
  url: string;
  id: string;
  title?: string;
  price?: number;
  description?: string;
  imageUrls: string[];
};

function searchCards(html: string): SearchCard[] {
  const cards = Array.from(html.matchAll(/<div data-private-srp-listing-item-id="(\d+)"[\s\S]*?(?=<div data-private-srp-listing-item-id="|$)/g));
  const parsed: SearchCard[] = [];
  for (const match of cards) {
    const id = match[1];
    const block = match[0];
    const href = block.match(/href="([^"]*\/fr\/vi\/[^"?#]+\/\d+)"/)?.[1];
    if (!href) continue;
    const title = decodeHtml(block.match(/aria-label="([^"]+)"/)?.[1]
      ?? block.match(/<h2[\s\S]*?<a[^>]*>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i)?.[1]
      ?? "");
    parsed.push({
      url: new URL(href, BASE_URL).toString(),
      id,
      title: title || undefined,
      price: parsePrice(block) ?? undefined,
      description: decodeHtml(block.match(/<span class="[^"]*">([\s\S]{20,600}?)<\/span>/i)?.[1] ?? ""),
      imageUrls: imageUrlsFrom(block)
    });
  }
  return parsed.slice(0, 10);
}

async function detailCandidate(card: SearchCard, radar: Radar): Promise<ProductCandidate | null> {
  const response = await liveFetch(card.url, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(16_000),
    next: { revalidate: 900 }
  });
  if (!response.ok) return null;
  const html = await response.text();
  const rawTitle = decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1] ?? "");
  if (INACTIVE_TITLE_RE.test(rawTitle) || !ACTIVE_RE.test(html) || !/<meta name="robots" content="index,follow"/i.test(html)) return null;
  const price = card.price ?? parsePrice(html) ?? null;
  if (!price) return null;
  const title = titleFrom(html) || card.title || "Annonce Tutti";
  const id = card.id;
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
    productUrl: card.url,
    imageUrls: imageUrlsFrom(html).length ? imageUrlsFrom(html) : card.imageUrls,
    description: descriptionFrom(html) || card.description,
    rawPayload: { marketplace: "Tutti Switzerland", activeVerified: true, availabilityEvidence: "search_price_plus_detail_index_follow_no_inactive_marker" }
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
        const response = await liveFetch(`${BASE_URL}/fr/q?query=${encodeURIComponent(query)}`, {
          headers: BROWSER_HEADERS,
          signal: AbortSignal.timeout(12_000),
          next: { revalidate: 900 }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        const cards = searchCards(html);
        const items = await Promise.all(cards.map(async (card) => {
          try {
            return await detailCandidate(card, radar);
          } catch (error) {
            console.warn(`Tutti, annonce ${card.id} ignorée: ${fetchErrorMessage(error)}`);
            return null;
          }
        }));
        return { items: items.filter((item): item is ProductCandidate => Boolean(item)), error: null };
      } catch (error) {
        const message = fetchErrorMessage(error);
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
