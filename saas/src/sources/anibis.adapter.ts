import type { ConditionGrade, ProductCandidate, Radar, SourceAdapter } from "@/types";
import { inferRadarBrand } from "./ebay.adapter";
import { fetchErrorMessage, liveFetch } from "./live-http";

const BASE_URL = "https://www.anibis.ch";
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "fr-CH,fr;q=0.9,en;q=0.8"
};
const INACTIVE_RE = /annonce supprimée|annonce expiree|annonce expirée|n.est plus disponible|deja vendu|déjà vendu|vendu|sold/i;
const ACTIVE_RE = /contacter l.annonceur|contattare inserzionista|inserent kontaktieren|retenir|merker|prix chf|preis chf|prezzo chf/i;

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
  const match = value.match(/(?:Prix CHF|Preis CHF|Prezzo CHF|CHF|>)(?:\s|&nbsp;)*([\d'’.,\s]+)(?:\.-|\s*CHF)?/i)
    ?? value.match(/([\d'’.,\s]+)\.-/);
  if (!match) return null;
  const parsed = Number(match[1].replace(/[\s'’]/g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function conditionGrade(value: string): ConditionGrade {
  const text = normalized(value);
  if (/neuf|nouveau|jamais porte|ungetragen/.test(text)) return "NEW";
  if (/excellent|tres bon|très bon|faibles traces|sehr gut/.test(text)) return "A";
  if (/occasion|bon etat|bon état|gebraucht|utilise/.test(text)) return "B";
  if (/usage|usure|acceptable|mauvais/.test(text)) return "C";
  if (/defectueux|pour pieces|reparation|defekt/.test(text)) return "REPAIR";
  return "UNKNOWN";
}

function titleFrom(html: string) {
  return decodeHtml(
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      ?? html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1]
      ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      ?? "Annonce Anibis"
  ).replace(/\s+-\s+anibis\.ch.*$/i, "");
}

function imageUrlsFrom(html: string) {
  return [...new Set([
    ...Array.from(html.matchAll(/<meta property="og:image" content="([^"]+)"/gi)).map((match) => match[1]),
    ...Array.from(html.matchAll(/https:\/\/[^"'\s]+(?:anibis|scout24|cloudfront)[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi)).map((match) => match[0])
  ])].filter((url) => !/placeholder|empty/i.test(url)).slice(0, 10);
}

function detailLinks(html: string) {
  return [...new Set(Array.from(html.matchAll(/href="([^"]*\/fr\/vi\/[^"?#]+\/\d+)"/g))
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
  const text = normalized(html);
  if (INACTIVE_RE.test(text) || !ACTIVE_RE.test(text)) return null;
  const title = titleFrom(html);
  const price = parsePrice(html.match(/(?:Prix CHF|Preis CHF|Prezzo CHF)[\s\S]{0,120}/i)?.[0] ?? html);
  if (!price) return null;
  const id = url.match(/\/(\d+)\/?$/)?.[1] ?? url;
  const shippingText = /envoi|livraison|versand|spedizione/i.test(html) ? "Retrait/envoi selon annonce" : undefined;
  return {
    source: "anibis",
    sourceItemId: id,
    title,
    brand: inferRadarBrand(title, radar.brands),
    category: radar.category,
    priceAmount: price,
    priceCurrency: "CHF",
    buyNowPrice: price,
    saleType: "BUY_NOW",
    conditionText: decodeHtml(html.match(/État[\s\S]{0,180}/i)?.[0] ?? html.match(/Zustand[\s\S]{0,180}/i)?.[0] ?? ""),
    conditionGrade: conditionGrade(html),
    sellerCountry: "CH",
    itemCountry: "CH",
    productUrl: url,
    imageUrls: imageUrlsFrom(html),
    description: decodeHtml(html.match(/<meta name="description" content="([^"]+)"/i)?.[1] ?? ""),
    rawPayload: { marketplace: "Anibis Switzerland", activeVerified: true, shippingText }
  };
}

export const anibisAdapter: SourceAdapter = {
  name: "anibis",
  enabled: process.env.ENABLE_ANIBIS_SOURCE !== "false",
  async scan(radar) {
    if (!this.enabled) return [];
    const queries = radar.brands.length
      ? radar.brands.map((brand) => [brand, ...radar.models, ...radar.include_keywords, radar.category].filter(Boolean).join(" "))
      : [[...radar.models, ...radar.include_keywords, radar.category].filter(Boolean).join(" ")];
    const results = await Promise.all(queries.slice(0, 6).map(async (query) => {
      try {
        const response = await liveFetch(`${BASE_URL}/fr/q/${encodeURIComponent(query)}`, {
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
        console.warn(`Anibis, requête « ${query} » ignorée: ${message}`);
        return { items: [] as ProductCandidate[], error: message };
      }
    }));
    if (results.every((result) => result.error)) {
      throw new Error(`Toutes les requêtes Anibis ont échoué: ${results.map((result) => result.error).join("; ")}`);
    }
    return [...new Map(results.flatMap((result) => result.items).map((item) => [item.sourceItemId, item])).values()];
  }
};
