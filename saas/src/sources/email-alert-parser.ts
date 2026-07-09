import type { ParsedMail } from "mailparser";
import type { ProductCandidate, Radar } from "@/types";

const TRACKING_WORDS = [
  "unsubscribe",
  "preferences",
  "privacy",
  "account",
  "login",
  "help",
  "support",
  "terms",
  "newsletter"
];

const MARKETPLACE_HOSTS = [
  "ebay.",
  "ricardo.ch",
  "anibis.ch",
  "komehyo.jp",
  "buyee.jp",
  "yahoo.co.jp",
  "yahoo.jp",
  "chrono24.",
  "vestiairecollective.",
  "vinted.",
  "leboncoin.fr"
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  "€": "EUR",
  "$": "USD",
  "£": "GBP",
  "¥": "JPY"
};

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function emailAllowedSenders() {
  return (process.env.EMAIL_ALLOWED_SENDERS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function senderAllowed(sender: string, allowList = emailAllowedSenders()) {
  const normalized = sender.toLowerCase();
  const senderDomain = normalized.split("@").pop() ?? normalized;
  return !allowList.length || allowList.some((allowed) => {
    const value = allowed.startsWith("@") ? allowed.slice(1) : allowed;
    return normalized === value || senderDomain === value || senderDomain.endsWith(`.${value}`);
  });
}

export function extractUrlsFromEmail(parsed: Pick<ParsedMail, "text" | "html">) {
  const content = `${parsed.text ?? ""}\n${parsed.html ?? ""}`;
  const urls = [...content.matchAll(/https?:\/\/[^\s<>"')]+/gi)]
    .map((match) => match[0].replace(/&amp;/g, "&").replace(/[.,;]+$/g, ""));
  return [...new Set(urls)];
}

export function bestMarketplaceUrl(urls: string[]) {
  const cleaned = urls.filter((url) => !TRACKING_WORDS.some((word) => url.toLowerCase().includes(word)));
  return cleaned.find((url) => MARKETPLACE_HOSTS.some((host) => url.toLowerCase().includes(host))) ?? cleaned[0] ?? null;
}

export function sourceFromEmail(sender: string, url?: string | null) {
  const value = `${sender} ${url ?? ""}`.toLowerCase();
  if (value.includes("ebay.")) return "email:ebay";
  if (value.includes("ricardo.ch")) return "email:ricardo";
  if (value.includes("anibis.ch")) return "email:anibis";
  if (value.includes("komehyo.jp")) return "email:komehyo";
  if (value.includes("buyee.jp")) return "email:buyee";
  if (value.includes("yahoo.co.jp") || value.includes("yahoo.jp")) return "email:yahoo-japan";
  const domain = sender.split("@")[1] ?? "alert";
  return `email:${domain}`;
}

function normalizeAmount(value: string) {
  const cleaned = value.replace(/'/g, "").replace(/\s/g, "");
  const decimal = cleaned.includes(",") && !cleaned.includes(".")
    ? cleaned.replace(",", ".")
    : cleaned.replace(/,/g, "");
  const amount = Number(decimal);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function extractPrice(text: string) {
  const patterns = [
    /\b(CHF|EUR|USD|GBP|JPY)\s*([0-9][0-9'’.,\s]*)/i,
    /([€$£¥])\s*([0-9][0-9'’.,\s]*)/i,
    /([0-9][0-9'’.,\s]*)\s*(CHF|EUR|USD|GBP|JPY)\b/i,
    /([0-9][0-9'’.,\s]*)\s*([€$£¥])/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const first = match[1];
    const second = match[2];
    const currencyToken = /[0-9]/.test(first) ? second : first;
    const amountToken = /[0-9]/.test(first) ? first : second;
    const amount = normalizeAmount(amountToken.replace("’", "'"));
    if (!amount) continue;
    return {
      amount,
      currency: CURRENCY_SYMBOLS[currencyToken] ?? currencyToken.toUpperCase()
    };
  }
  return null;
}

function matchesRadarText(body: string, radar: Radar) {
  const terms = [...radar.brands, ...radar.models, ...radar.include_keywords, radar.category]
    .map((term) => term.toLowerCase())
    .filter(Boolean);
  return !terms.length || terms.some((term) => body.toLowerCase().includes(term));
}

export function parseEmailAlertToCandidate(
  parsed: ParsedMail,
  radar: Radar,
  meta: { uid: number | string; sender: string }
): ProductCandidate | null {
  const sender = meta.sender.toLowerCase();
  if (!senderAllowed(sender)) return null;
  const body = cleanText(`${parsed.subject ?? ""}\n${parsed.text ?? ""}`);
  if (!matchesRadarText(body, radar)) return null;
  const productUrl = bestMarketplaceUrl(extractUrlsFromEmail(parsed));
  const price = extractPrice(body);
  if (!productUrl || !price) return null;
  const html = typeof parsed.html === "string" ? parsed.html : "";
  const images = [...html.matchAll(/<img[^>]+src=["']([^"']+)/gi)]
    .map((match) => match[1])
    .filter((url) => url.startsWith("http"))
    .slice(0, 5);
  return {
    source: sourceFromEmail(sender, productUrl),
    sourceItemId: `imap-${meta.uid}`,
    title: cleanText(parsed.subject) || "Alerte marketplace",
    priceAmount: price.amount,
    priceCurrency: price.currency,
    productUrl,
    imageUrls: images,
    description: parsed.text?.slice(0, 4000),
    conditionGrade: "UNKNOWN",
    rawPayload: { sender, messageId: parsed.messageId ?? null, mailboxUid: meta.uid }
  };
}
