import type { Radar } from "@/types";

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .toLowerCase()
  .replace(/&/g, " and ")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const unique = (values: string[]) => {
  const seen = new Set<string>();
  return values.map((value) => value.trim().replace(/\s+/g, " ")).filter((value) => {
    const key = normalize(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

type IntentRule = {
  id: string;
  matches: RegExp[];
  categoryHints: string[];
  synonyms: string[];
  translations: string[];
  sellerTerms?: string[];
  negativeTerms?: string[];
};

const INTENTS: IntentRule[] = [
  {
    id: "watch",
    matches: [/\b(montre|montres|watch|watches|uhr|uhren|orologio|reloj)\b/i],
    categoryHints: ["watch", "wristwatch"],
    synonyms: ["watch", "wristwatch", "timepiece"],
    translations: ["montre", "uhr", "orologio", "reloj", "腕時計"],
    sellerTerms: ["pre owned", "vintage", "automatic", "quartz"],
  },
  {
    id: "eyewear",
    matches: [/\b(lunette|lunettes|glasses|eyewear|sunglasses|brille|brillen|occhiali|gafas)\b/i],
    categoryHints: ["glasses", "eyewear"],
    synonyms: ["glasses", "eyewear", "spectacles", "sunglasses"],
    translations: ["lunettes", "brille", "brillen", "occhiali", "gafas"],
    sellerTerms: ["novelty glasses", "costume glasses", "party glasses"],
  },
  {
    id: "costume",
    matches: [/\b(mascotte|mascot|costume|cosplay|deguisement|déguisement|fasnacht|karneval)\b/i],
    categoryHints: ["costume accessory", "cosplay accessory"],
    synonyms: ["mascot", "costume", "cosplay", "novelty", "character accessory"],
    translations: ["mascotte", "deguisement", "fasnacht", "karneval", "kostum", "コスプレ"],
    sellerTerms: ["party accessory", "fancy dress", "themed costume"],
  },
  {
    id: "shoes",
    matches: [/\b(chaussure|chaussures|shoe|shoes|sneaker|sneakers|basket|baskets|schuh|schuhe)\b/i],
    categoryHints: ["shoes", "sneakers"],
    synonyms: ["shoes", "sneakers", "trainers", "footwear"],
    translations: ["chaussures", "schuhe", "scarpe", "zapatos"],
    sellerTerms: ["deadstock", "new in box", "pre owned"],
  },
  {
    id: "bag",
    matches: [/\b(sac|sacs|bag|bags|handbag|handbags|tasche|borsa|bolso)\b/i],
    categoryHints: ["bag", "handbag"],
    synonyms: ["bag", "handbag", "shoulder bag", "crossbody bag", "tote"],
    translations: ["sac", "tasche", "borsa", "bolso"],
    sellerTerms: ["pre owned", "vintage", "authentic"],
  },
  {
    id: "electronics",
    matches: [/\b(electronique|electronics|phone|smartphone|iphone|ordinateur|laptop|camera|console)\b/i],
    categoryHints: ["electronics"],
    synonyms: ["electronics", "device", "gadget"],
    translations: ["electronique", "elektronik", "elettronica"],
    sellerTerms: ["used", "refurbished", "open box"],
  },
  {
    id: "collectible",
    matches: [/\b(carte|cartes|card|cards|pokemon|pokémon|figurine|figure|collectible|collection)\b/i],
    categoryHints: ["collectible", "trading card"],
    synonyms: ["collectible", "trading card", "figure", "memorabilia"],
    translations: ["collection", "sammlerstuck", "collezione"],
    sellerTerms: ["sealed", "graded", "rare", "vintage"],
  },
];

const GENERIC_CATEGORY_ALIASES: Record<string, string[]> = {
  accessoire: ["accessory", "accessories", "zubehor", "accessorio"],
  accessoires: ["accessory", "accessories", "zubehor", "accessori"],
  vetement: ["clothing", "apparel", "kleidung", "abbigliamento"],
  vêtements: ["clothing", "apparel", "kleidung", "abbigliamento"],
  jouet: ["toy", "toys", "spielzeug", "giocattolo"],
  jouets: ["toy", "toys", "spielzeug", "giocattoli"],
  maison: ["home", "household", "haushalt", "casa"],
  art: ["art", "artwork", "kunst", "arte"],
  bijoux: ["jewelry", "jewellery", "schmuck", "gioielli"],
};

function tokenAlternatives(term: string) {
  const normalized = normalize(term);
  const aliases = GENERIC_CATEGORY_ALIASES[normalized] ?? [];
  return unique([term, ...aliases]);
}

export function detectQueryIntents(input: Pick<Radar, "category" | "brands" | "models" | "include_keywords">) {
  const text = [input.category, ...input.brands, ...input.models, ...input.include_keywords].join(" ");
  return INTENTS.filter((intent) => intent.matches.some((pattern) => pattern.test(text)));
}

function coreTerms(input: Pick<Radar, "category" | "brands" | "models" | "include_keywords">) {
  return unique([...input.brands, ...input.models, ...input.include_keywords]);
}

export type IntelligentQuery = {
  query: string;
  intentIds: string[];
  precision: "exact" | "expanded" | "discovery";
};

export function buildIntelligentQueries(
  input: Pick<Radar, "category" | "brands" | "models" | "include_keywords">,
  limit = 24,
): IntelligentQuery[] {
  const intents = detectQueryIntents(input);
  const intentIds = intents.map((intent) => intent.id);
  const cores = coreTerms(input);
  const categoryTerms = unique([
    input.category,
    ...tokenAlternatives(input.category),
    ...intents.flatMap((intent) => [...intent.categoryHints, ...intent.synonyms, ...intent.translations]),
  ]);
  const sellerTerms = unique(intents.flatMap((intent) => intent.sellerTerms ?? []));
  const output: IntelligentQuery[] = [];
  const push = (query: string, precision: IntelligentQuery["precision"]) => {
    const clean = query.trim().replace(/\s+/g, " ");
    if (!clean) return;
    if (output.some((item) => normalize(item.query) === normalize(clean))) return;
    output.push({ query: clean, intentIds, precision });
  };

  const exactBase = [...cores, input.category].filter(Boolean).join(" ");
  push(exactBase, "exact");
  if (cores.length) push(cores.join(" "), "exact");

  const primaryCores = cores.length ? cores : [""];
  for (const core of primaryCores.slice(0, 6)) {
    for (const categoryTerm of categoryTerms.slice(0, 12)) {
      push([core, categoryTerm].filter(Boolean).join(" "), "expanded");
      if (output.length >= limit) return output;
    }
  }

  for (const core of primaryCores.slice(0, 4)) {
    for (const sellerTerm of sellerTerms.slice(0, 8)) {
      push([core, sellerTerm].filter(Boolean).join(" "), "discovery");
      if (output.length >= limit) return output;
    }
  }

  if (!cores.length) {
    for (const categoryTerm of categoryTerms.slice(0, 8)) {
      push(categoryTerm, "discovery");
      if (output.length >= limit) break;
    }
  }

  return output.slice(0, limit);
}

export function intelligentSearchQueries(
  input: Pick<Radar, "category" | "brands" | "models" | "include_keywords">,
  limit = 24,
) {
  return buildIntelligentQueries(input, limit).map((item) => item.query);
}

export function isIntelligentlyRelevantListing(
  title: string,
  input: Pick<Radar, "category" | "brands" | "models" | "include_keywords">,
) {
  const normalizedTitle = normalize(title);
  if (!normalizedTitle) return false;
  const cores = coreTerms(input).map(normalize).filter(Boolean);
  const intents = detectQueryIntents(input);
  const intentSignals = unique(intents.flatMap((intent) => [
    ...intent.categoryHints,
    ...intent.synonyms,
    ...intent.translations,
    ...(intent.sellerTerms ?? []),
  ])).map(normalize);

  const hasCore = !cores.length || cores.some((term) => normalizedTitle.includes(term));
  const hasIntent = !intentSignals.length || intentSignals.some((term) => normalizedTitle.includes(term));

  // A precise brand/model/keyword match is enough. For generic searches, require an intent signal.
  if (cores.length) return hasCore;
  return hasIntent;
}
