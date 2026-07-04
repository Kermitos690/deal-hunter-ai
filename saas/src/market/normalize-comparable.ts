export function normalizeMarketText(value?: string | null) {
  return value?.normalize("NFKC").replace(/\s+/g, " ").trim() || null;
}

export function normalizeReference(value?: string | null) {
  return normalizeMarketText(value)?.toUpperCase().replace(/\s*[-/]\s*/g, "-") ?? null;
}
