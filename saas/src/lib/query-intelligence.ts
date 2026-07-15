import { isWatchCategory, looksLikeCompleteWatchTitle, matchesAnySearchTerm, searchTermAlternatives } from "@/lib/search-precision";
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

type RadarSearchInput = Pick<Radar, "category" | "brands" | "models" | "include_keywords">;

type IntentRule = {
  id: string;
  matches: RegExp[];
  categoryHints: string[];
  synonyms: string[];
  translations: string[];
  sellerTerms?: string[];
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
  const aliases = GENERIC_CATEGORY_ALIASES[normalize(term)] ?? [];
  return unique([term, ...aliases]);
}

export function detectQueryIntents(input: RadarSearchInput) {
  const text = [input.category, ...input.brands, ...input.models, ...input.include_keywords].join(" ");
  return INTENTS.filter((intent) => intent.matches.some((pattern) => pattern.test(text)));
}

function coreTerms(input: RadarSearchInput) {
  return unique([...input.brands, ...input.models, ...input.include_keywords]);
}

function expertCoreCombinations(cores: string[], limit = 12) {
  if (!cores.length) return [[]] as string[][];
  let combinations: string[][] = [[]];
  for (const core of cores) {
    const alternatives = searchTermAlternatives(core).slice(0, 4);
    const next: string[][] = [];
    for (const combination of combinations) {
      for (const alternative of alternatives.length ? alternatives : [core]) {
        next.push([...combination, alternative]);
        if (next.length >= limit) break;
      }
      if (next.length >= limit) break;
    }
    combinations = next.slice(0, limit);
  }
  return combinations;
}

export type IntelligentQuery = {
  query: string;
  intentIds: string[];
  precision: "exact" | "expanded" | "discovery";
};

export function buildIntelligentQueries(input: RadarSearchInput, limit = 24): IntelligentQuery[] {
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
    if (output.length >= limit) return;
    const clean = query.trim().replace(/\s+/g, " ");
    if (!clean || output.some((item) => normalize(item.query) === normalize(clean))) return;
    output.push({ query: clean, intentIds, precision });
  };

  const exactBase = [...cores, input.category].filter(Boolean).join(" ");
  push(exactBase, "exact");
  if (cores.length) push(cores.join(" "), "exact");

  const primaryCategoryHint = intents[0]?.categoryHints[0] ?? tokenAlternatives(input.category)[1] ?? input.category;
  for (const combination of expertCoreCombinations(cores, 12)) {
    push([...combination, primaryCategoryHint].filter(Boolean).join(" "), "expanded");
    if (output.length >= Math.min(limit, 14)) break;
  }

  if (intents.length > 1) {
    const [first, second] = intents;
    const firstPrimary = first.synonyms[0] ?? first.categoryHints[0] ?? "";
    const secondPrimary = second.synonyms[0] ?? second.categoryHints[0] ?? "";
    push(`${firstPrimary} ${secondPrimary}`, "expanded");
    push(`${firstPrimary} ${second.categoryHints[0] ?? secondPrimary}`, "expanded");
    push(`${firstPrimary} ${second.categoryHints[1] ?? secondPrimary}`, "expanded");

    const intentSignals = intents.map((intent) => unique([
      ...intent.synonyms,
      ...intent.categoryHints,
      ...intent.translations,
    ]).slice(0, 7));
    const [firstSignals = [], secondSignals = []] = intentSignals;
    for (const left of firstSignals) {
      for (const right of secondSignals) {
        push(`${left} ${right}`, "expanded");
        push([cores[0], left, right].filter(Boolean).join(" "), "expanded");
        if (output.length >= Math.min(limit, 18)) break;
      }
      if (output.length >= Math.min(limit, 18)) break;
    }
  }

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

export function intelligentSearchQueries(input: RadarSearchInput, limit = 24) {
  return buildIntelligentQueries(input, limit).map((item) => item.query);
}

export function isIntelligentlyRelevantListing(title: string, input: RadarSearchInput) {
  const normalizedTitle = normalize(title);
  if (!normalizedTitle) return false;
  const cores = coreTerms(input).flatMap((term) => searchTermAlternatives(term)).map(normalize).filter(Boolean);
  const hasCore = cores.some((term) => normalizedTitle.includes(term));
  if (hasCore) return true;

  const intents = detectQueryIntents(input);
  const intentMatches = intents.map((intent) => unique([
    ...intent.categoryHints,
    ...intent.synonyms,
    ...intent.translations,
    ...(intent.sellerTerms ?? []),
  ]).map(normalize).some((term) => normalizedTitle.includes(term)));

  if (intents.length > 1) return intentMatches.every(Boolean);
  if (!cores.length && intents.length === 1) return intentMatches[0] ?? false;
  return false;
}

const OBVIOUS_WATCH_ACCESSORY_RE = /(?:watch (?:glass|crystal|strap|band|case)|replacement (?:glass|crystal|strap|bracelet|dial|bezel)|(?:strap|bracelet|band|crystal|glass) for|(?:dial|cadran|movement|mouvement|watch case|boitier) only|empty (?:watch )?box|watch not included|without watch|sans montre|catalogue?|brochure)/i;

export function isMarketplaceRelevantListing(
  title: string,
  input: RadarSearchInput,
  options: { allowConciseWatchTitle?: boolean } = { allowConciseWatchTitle: true },
) {
  const expectedTerms = [...input.brands, ...input.models, ...input.include_keywords];
  if (isWatchCategory(input.category)) {
    if (looksLikeCompleteWatchTitle(title, expectedTerms)) return true;
    if (!options.allowConciseWatchTitle || !expectedTerms.length) return false;
    return matchesAnySearchTerm(title, expectedTerms) && !OBVIOUS_WATCH_ACCESSORY_RE.test(title);
  }
  return isIntelligentlyRelevantListing(title, input);
}
