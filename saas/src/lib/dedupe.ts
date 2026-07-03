import crypto from "node:crypto";
import type { ProductCandidate } from "@/types";

export function normalizeUrl(raw: string) {
  const url = new URL(raw);
  url.hash = "";
  ["utm_source", "utm_medium", "utm_campaign", "fbclid", "gclid"].forEach((key) =>
    url.searchParams.delete(key)
  );
  return `${url.origin}${url.pathname}${url.searchParams.size ? `?${url.searchParams}` : ""}`
    .replace(/\/$/, "")
    .toLowerCase();
}

export function productFingerprint(candidate: ProductCandidate) {
  const normalizedTitle = candidate.title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const value = [
    normalizedTitle,
    candidate.priceAmount.toFixed(2),
    candidate.sellerName?.toLowerCase() ?? ""
  ].join("|");
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function candidateKey(candidate: ProductCandidate) {
  return `${candidate.source}:${candidate.sourceItemId || normalizeUrl(candidate.productUrl)}`;
}
