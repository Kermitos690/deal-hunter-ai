import type { ProductCandidate, Radar } from "@/types";

export type PokemonProductType =
  | "RAW_SINGLE"
  | "GRADED_CARD"
  | "SEALED_PRODUCT"
  | "LOT_COLLECTION"
  | "ACCESSORY"
  | "UNKNOWN";

export type PokemonGradingCompany = "PSA" | "BGS" | "CGC" | "SGC" | "ACE" | "PCA" | "UNKNOWN";
export type PokemonLanguage = "EN" | "FR" | "DE" | "IT" | "ES" | "JP" | "KR" | "CN" | "UNKNOWN";

export type PokemonRadarConfig = {
  productTypes?: PokemonProductType[];
  gradingCompanies?: PokemonGradingCompany[];
  minimumGrade?: number | null;
  languages?: PokemonLanguage[];
  sets?: string[];
  rarities?: string[];
  cardNumbers?: string[];
  releaseYears?: number[];
  includeFirstEdition?: boolean;
  includePromos?: boolean;
  includeUngraded?: boolean;
  includeGraded?: boolean;
};

export type PokemonTcgAttributes = {
  franchise: "pokemon";
  productType: PokemonProductType;
  setName?: string;
  setCode?: string;
  cardNumber?: string;
  rarity?: string;
  language: PokemonLanguage;
  releaseYear?: number;
  isRecentRelease: boolean;
  gradingCompany?: PokemonGradingCompany;
  grade?: number;
  certificationNumber?: string;
  isFirstEdition: boolean;
  isHolo: boolean;
  isReverseHolo: boolean;
  isPromo: boolean;
  isSealed: boolean;
  rawCondition?: "NM" | "LP" | "MP" | "HP" | "DMG" | "UNKNOWN";
  authenticityRiskTerms: string[];
};

export const POKEMON_RELEASES_2025_2026 = [
  { name: "Prismatic Evolutions", year: 2025, aliases: ["prismatic evolutions", "evolutions prismatiques", "terastal festival"] },
  { name: "Journey Together", year: 2025, aliases: ["journey together", "aventures ensemble", "battle partners"] },
  { name: "Destined Rivals", year: 2025, aliases: ["destined rivals", "rivalites destinees", "the glory of team rocket"] },
  { name: "Black Bolt", year: 2025, aliases: ["black bolt", "foudre noire"] },
  { name: "White Flare", year: 2025, aliases: ["white flare", "flamme blanche"] },
  { name: "Mega Evolution", year: 2025, aliases: ["mega evolution", "mega-evolution", "mega evolution base"] },
  { name: "Phantasmal Flames", year: 2025, aliases: ["phantasmal flames"] },
  { name: "Ascended Heroes", year: 2026, aliases: ["ascended heroes"] },
  { name: "Perfect Order", year: 2026, aliases: ["perfect order"] },
  { name: "Chaos Rising", year: 2026, aliases: ["chaos rising"] },
  { name: "Pitch Black", year: 2026, aliases: ["pitch black"] }
] as const;

const normalized = (value: string) => value
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .toLowerCase();

const unique = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))];

export function isPokemonTcgCategory(category?: string) {
  const value = normalized(category ?? "");
  return value.includes("pokemon") || value.includes("carte") || value.includes("trading card") || value.includes("tcg");
}

export function isPokemonRadar(radar: Pick<Radar, "category" | "brands" | "models">) {
  return normalized(radar.category).includes("pokemon")
    || radar.brands.some((brand) => normalized(brand).includes("pokemon"))
    || radar.models.some((model) => model.startsWith("tcg:"));
}

function looksLikePokemonCandidate(candidate: ProductCandidate) {
  const text = normalized(`${candidate.title} ${candidate.brand ?? ""} ${candidate.description ?? ""}`);
  return /(pokemon|pokémon|charizard|pikachu|dracaufeu|mewtwo|mew\b|eevee|evoli|umbreon|noctali|lugia|rayquaza|gengar|ectoplasma)/.test(text);
}

function detectProductType(text: string, gradingCompany?: PokemonGradingCompany): PokemonProductType {
  if (gradingCompany && gradingCompany !== "UNKNOWN") return "GRADED_CARD";
  if (/(booster box|display|elite trainer box|\betb\b|booster bundle|blister|tin\b|collection box|sealed case|scelle|scellé|factory sealed|unopened)/.test(text)) return "SEALED_PRODUCT";
  if (/(binder|collection|bulk|lot\b|bundle of cards|job lot|classeur|collection complete|set complet)/.test(text)) return "LOT_COLLECTION";
  if (/(sleeve|binder only|toploader|playmat|deck box|empty box|boite vide|accessory|accessoire)/.test(text)) return "ACCESSORY";
  if (/(pokemon|pokémon|charizard|pikachu|mew|eevee|dracaufeu|carte|card)/.test(text)) return "RAW_SINGLE";
  return "UNKNOWN";
}

function detectGrading(text: string) {
  const companyMatch = text.match(/\b(psa|bgs|cgc|sgc|ace|pca)\b/i);
  const gradingCompany = (companyMatch?.[1]?.toUpperCase() ?? "UNKNOWN") as PokemonGradingCompany;
  const gradeMatch = text.match(/\b(?:psa|bgs|cgc|sgc|ace|pca)\s*(?:gem\s*mint|mint|nm[- ]?mt|pristine|black label)?\s*(10|9\.5|9|8\.5|8|7\.5|7|6\.5|6|5\.5|5|4|3|2|1)\b/i);
  const certificationMatch = text.match(/\b(?:cert(?:ification)?|serial)\s*#?\s*([0-9]{6,12})\b/i);
  return {
    gradingCompany,
    grade: gradeMatch ? Number(gradeMatch[1]) : undefined,
    certificationNumber: certificationMatch?.[1]
  };
}

function detectLanguage(text: string): PokemonLanguage {
  if (/(japanese|japan|japonais|japonaise|jp\b)/.test(text)) return "JP";
  if (/(french|francais|française|fr\b)/.test(text)) return "FR";
  if (/(german|deutsch|allemand|de\b)/.test(text)) return "DE";
  if (/(italian|italiano|italien|it\b)/.test(text)) return "IT";
  if (/(spanish|espanol|espagnol|es\b)/.test(text)) return "ES";
  if (/(korean|coreen|kr\b)/.test(text)) return "KR";
  if (/(chinese|simplified chinese|traditional chinese|cn\b)/.test(text)) return "CN";
  if (/(english|anglais|en\b)/.test(text)) return "EN";
  return "UNKNOWN";
}

function detectRawCondition(text: string): PokemonTcgAttributes["rawCondition"] {
  if (/\b(nm|near mint|mint)\b/.test(text)) return "NM";
  if (/\b(lp|lightly played|excellent)\b/.test(text)) return "LP";
  if (/\b(mp|moderately played|played)\b/.test(text)) return "MP";
  if (/\b(hp|heavily played|poor)\b/.test(text)) return "HP";
  if (/\b(dmg|damaged|crease|creased|pliee|pliée)\b/.test(text)) return "DMG";
  return "UNKNOWN";
}

function detectRarity(text: string) {
  const patterns: Array<[RegExp, string]> = [
    [/\b(sir|special illustration rare)\b/, "SIR"],
    [/\b(ir|illustration rare)\b/, "IR"],
    [/\b(sar|special art rare)\b/, "SAR"],
    [/\b(alt art|alternative art)\b/, "ALT_ART"],
    [/\b(hyper rare|gold rare)\b/, "HYPER_RARE"],
    [/\b(secret rare)\b/, "SECRET_RARE"],
    [/\b(ultra rare)\b/, "ULTRA_RARE"],
    [/\b(rainbow rare)\b/, "RAINBOW_RARE"],
    [/\b(shiny|shining)\b/, "SHINY"],
    [/\b(ex|gx|vmax|vstar)\b/, "SPECIAL_MECHANIC"]
  ];
  return patterns.find(([pattern]) => pattern.test(text))?.[1];
}

export function parsePokemonTcgTitle(title: string, description = ""): PokemonTcgAttributes {
  const text = normalized(`${title} ${description}`);
  const grading = detectGrading(text);
  const release = POKEMON_RELEASES_2025_2026
    .flatMap((item) => item.aliases.flatMap((alias) => {
      const normalizedAlias = normalized(alias);
      const index = text.lastIndexOf(normalizedAlias);
      return index >= 0 ? [{ item, index, aliasLength: normalizedAlias.length }] : [];
    }))
    .sort((a, b) => b.index - a.index || b.aliasLength - a.aliasLength)[0]?.item;
  const numberMatch = text.match(/(?:#|no\.?\s*)?\b([a-z]{0,3}\d{1,3}[a-z]?\/\d{1,3}[a-z]?)\b/i);
  const authenticityRiskTerms = [
    "proxy", "replica", "fake", "counterfeit", "custom card", "fan art", "orica",
    "gold metal card", "metal card", "reprint", "not official", "non officielle", "non official"
  ].filter((term) => text.includes(term));
  const productType = detectProductType(text, grading.gradingCompany);

  return {
    franchise: "pokemon",
    productType,
    setName: release?.name,
    cardNumber: numberMatch?.[1]?.toUpperCase(),
    rarity: detectRarity(text),
    language: detectLanguage(text),
    releaseYear: release?.year,
    isRecentRelease: release?.year === 2025 || release?.year === 2026,
    gradingCompany: grading.gradingCompany === "UNKNOWN" ? undefined : grading.gradingCompany,
    grade: grading.grade,
    certificationNumber: grading.certificationNumber,
    isFirstEdition: /\b(1st edition|first edition|1ere edition|1ère édition)\b/.test(text),
    isHolo: /\b(holo|holographic|holographique)\b/.test(text),
    isReverseHolo: /\b(reverse holo|holo reverse|reverse)\b/.test(text),
    isPromo: /\b(promo|promotional|black star)\b/.test(text),
    isSealed: productType === "SEALED_PRODUCT",
    rawCondition: productType === "RAW_SINGLE" ? detectRawCondition(text) : undefined,
    authenticityRiskTerms
  };
}

export function enrichPokemonCandidate(candidate: ProductCandidate): ProductCandidate {
  if (!looksLikePokemonCandidate(candidate)) return candidate;
  const attributes = parsePokemonTcgTitle(candidate.title, candidate.description);
  return {
    ...candidate,
    brand: candidate.brand ?? "Pokémon",
    model: candidate.model ?? attributes.setName,
    verticalAttributes: attributes,
    rawPayload: {
      ...(candidate.rawPayload ?? {}),
      pokemonTcg: attributes
    }
  };
}

export function pokemonRadarConfigFromModels(models: string[]): PokemonRadarConfig {
  const config: PokemonRadarConfig = {};
  const push = <K extends keyof PokemonRadarConfig>(key: K, value: string) => {
    const current = (config[key] as string[] | undefined) ?? [];
    (config as Record<string, unknown>)[key] = [...current, value];
  };
  for (const model of models) {
    if (!model.startsWith("tcg:")) continue;
    const [, key, ...rest] = model.split(":");
    const value = rest.join(":").trim();
    if (!value) continue;
    if (key === "type") push("productTypes", value);
    if (key === "grader") push("gradingCompanies", value);
    if (key === "language") push("languages", value);
    if (key === "set") push("sets", value);
    if (key === "rarity") push("rarities", value);
    if (key === "number") push("cardNumbers", value);
    if (key === "year") {
      const year = Number(value);
      if (Number.isInteger(year)) config.releaseYears = [...(config.releaseYears ?? []), year];
    }
    if (key === "min-grade") {
      const grade = Number(value);
      if (Number.isFinite(grade)) config.minimumGrade = grade;
    }
    if (key === "first-edition") config.includeFirstEdition = value === "true";
    if (key === "promos") config.includePromos = value !== "false";
    if (key === "ungraded") config.includeUngraded = value !== "false";
    if (key === "graded") config.includeGraded = value !== "false";
  }
  return config;
}

export function pokemonRadarDirectives(config: PokemonRadarConfig) {
  return unique([
    ...(config.productTypes ?? []).map((value) => `tcg:type:${value}`),
    ...(config.gradingCompanies ?? []).map((value) => `tcg:grader:${value}`),
    ...(config.languages ?? []).map((value) => `tcg:language:${value}`),
    ...(config.sets ?? []).map((value) => `tcg:set:${value}`),
    ...(config.rarities ?? []).map((value) => `tcg:rarity:${value}`),
    ...(config.cardNumbers ?? []).map((value) => `tcg:number:${value}`),
    ...(config.releaseYears ?? []).map((value) => `tcg:year:${value}`),
    config.minimumGrade ? `tcg:min-grade:${config.minimumGrade}` : "",
    config.includeFirstEdition ? "tcg:first-edition:true" : "",
    config.includePromos === false ? "tcg:promos:false" : "",
    config.includeUngraded === false ? "tcg:ungraded:false" : "",
    config.includeGraded === false ? "tcg:graded:false" : ""
  ]);
}

function configFor(radar: Radar): PokemonRadarConfig {
  return pokemonRadarConfigFromModels(radar.models);
}

export function pokemonSearchQueries(radar: Radar) {
  const config = configFor(radar);
  const base = unique([
    ...radar.models.filter((model) => !model.startsWith("tcg:")),
    ...radar.include_keywords,
    ...(config.sets ?? []),
    ...(config.cardNumbers ?? []),
    ...(config.rarities ?? [])
  ]);
  const typeTerms: Record<PokemonProductType, string[]> = {
    RAW_SINGLE: ["card", "single"],
    GRADED_CARD: unique([...(config.gradingCompanies ?? ["PSA", "BGS", "CGC"]).map(String), config.minimumGrade ? String(config.minimumGrade) : ""]),
    SEALED_PRODUCT: ["sealed", "booster box", "elite trainer box"],
    LOT_COLLECTION: ["lot", "collection", "binder"],
    ACCESSORY: ["accessory"],
    UNKNOWN: []
  };
  const configuredTypes = config.productTypes?.length
    ? config.productTypes
    : ["RAW_SINGLE", "GRADED_CARD", "SEALED_PRODUCT", "LOT_COLLECTION"] as PokemonProductType[];
  const years = (config.releaseYears ?? []).map(String);
  const languages = (config.languages ?? []).filter((value) => value !== "UNKNOWN").map(String);
  const queries: string[] = [];

  for (const productType of configuredTypes) {
    const productTerms = typeTerms[productType];
    queries.push(unique(["Pokemon", ...base.slice(0, 4), ...productTerms.slice(0, 2), ...years.slice(0, 1), ...languages.slice(0, 1)]).join(" "));
    for (const setName of config.sets ?? []) {
      queries.push(unique(["Pokemon", setName, ...productTerms.slice(0, 2)]).join(" "));
    }
  }
  if (!queries.length) queries.push("Pokemon card");
  return unique(queries).slice(0, 24);
}

export function isRelevantPokemonListing(title: string, radar: Radar) {
  const attributes = parsePokemonTcgTitle(title);
  const config = configFor(radar);
  if (attributes.authenticityRiskTerms.length) return false;
  if (attributes.productType === "ACCESSORY" && !(config.productTypes ?? []).includes("ACCESSORY")) return false;
  if (/(digital card|online code|code card|ptcgo|ptcgl|mystery pack|mystery box)/i.test(title)) return false;
  return attributes.productType !== "UNKNOWN";
}

export function pokemonCandidateMismatchReasons(candidate: ProductCandidate, radar: Radar) {
  if (!isPokemonRadar(radar)) return [];
  if (!looksLikePokemonCandidate(candidate)) return ["pokemon_not_recognized"];
  const attributes = (candidate.verticalAttributes ?? parsePokemonTcgTitle(candidate.title, candidate.description)) as PokemonTcgAttributes;
  const config = configFor(radar);
  const reasons: string[] = [];

  if (attributes.authenticityRiskTerms.length) reasons.push("pokemon_authenticity_risk");
  if (config.productTypes?.length && !config.productTypes.includes(attributes.productType)) reasons.push("pokemon_product_type_not_accepted");
  if (config.gradingCompanies?.length && attributes.productType === "GRADED_CARD" && (!attributes.gradingCompany || !config.gradingCompanies.includes(attributes.gradingCompany))) reasons.push("pokemon_grader_not_accepted");
  if (config.minimumGrade && attributes.productType === "GRADED_CARD" && (!attributes.grade || attributes.grade < config.minimumGrade)) reasons.push("pokemon_grade_too_low");
  if (config.languages?.length && attributes.language !== "UNKNOWN" && !config.languages.includes(attributes.language)) reasons.push("pokemon_language_not_accepted");
  if (config.releaseYears?.length && attributes.releaseYear && !config.releaseYears.includes(attributes.releaseYear)) reasons.push("pokemon_release_year_not_accepted");
  if (config.sets?.length && attributes.setName && !config.sets.some((setName) => normalized(setName) === normalized(attributes.setName ?? ""))) reasons.push("pokemon_set_not_accepted");
  if (config.cardNumbers?.length && attributes.cardNumber && !config.cardNumbers.some((number) => normalized(number) === normalized(attributes.cardNumber ?? ""))) reasons.push("pokemon_card_number_not_accepted");
  if (config.rarities?.length && attributes.rarity && !config.rarities.some((rarity) => normalized(rarity) === normalized(attributes.rarity ?? ""))) reasons.push("pokemon_rarity_not_accepted");
  if (config.includeFirstEdition && !attributes.isFirstEdition) reasons.push("pokemon_first_edition_required");
  if (config.includePromos === false && attributes.isPromo) reasons.push("pokemon_promo_not_accepted");
  if (config.includeUngraded === false && attributes.productType === "RAW_SINGLE") reasons.push("pokemon_ungraded_not_accepted");
  if (config.includeGraded === false && attributes.productType === "GRADED_CARD") reasons.push("pokemon_graded_not_accepted");
  return reasons;
}

export function absoluteProfitScoreCap(netProfit: number) {
  if (netProfit < 0) return 15;
  if (netProfit < 10) return 39;
  if (netProfit < 25) return 54;
  if (netProfit < 50) return 69;
  return 100;
}

export function pokemonScoreWarnings(candidate: ProductCandidate) {
  const attributes = candidate.verticalAttributes as PokemonTcgAttributes | undefined;
  if (!attributes || attributes.franchise !== "pokemon") return [];
  const warnings: string[] = [];
  if (attributes.productType === "GRADED_CARD" && !attributes.certificationNumber) warnings.push("Slab détecté sans numéro de certification lisible dans l’annonce.");
  if (attributes.productType === "RAW_SINGLE" && attributes.rawCondition === "UNKNOWN") warnings.push("État raw non normalisé : demander recto, verso, coins, bords et surface.");
  if (attributes.isRecentRelease) warnings.push(`Sortie ${attributes.releaseYear} détectée : volatilité et effet de nouveauté à intégrer.`);
  if (attributes.language === "UNKNOWN") warnings.push("Langue de la carte non confirmée.");
  return warnings;
}

export function expandPokemonRadarForSources(radar: Radar): Radar {
  if (!isPokemonRadar(radar)) return radar;
  const phrases = pokemonSearchQueries(radar)
    .map((query) => query.replace(/^pokemon\s+/i, "").trim())
    .filter(Boolean);
  return {
    ...radar,
    brands: unique([...radar.brands, "Pokemon"]),
    models: unique([...radar.models.filter((model) => !model.startsWith("tcg:")), ...phrases]).slice(0, 24)
  };
}

export function pokemonAlertLines(candidate: ProductCandidate) {
  const attributes = candidate.verticalAttributes as PokemonTcgAttributes | undefined;
  if (!attributes || attributes.franchise !== "pokemon") return [];
  const typeLabels: Record<PokemonProductType, string> = {
    RAW_SINGLE: "Carte raw",
    GRADED_CARD: "Carte gradée",
    SEALED_PRODUCT: "Produit scellé",
    LOT_COLLECTION: "Lot / collection",
    ACCESSORY: "Accessoire",
    UNKNOWN: "Type à confirmer"
  };
  return [
    `🃏 Type : ${typeLabels[attributes.productType]}`,
    attributes.setName ? `📚 Set : ${attributes.setName}${attributes.setCode ? ` (${attributes.setCode})` : ""}` : null,
    attributes.cardNumber ? `🔢 Numéro : ${attributes.cardNumber}` : null,
    attributes.rarity ? `💎 Rareté : ${attributes.rarity}` : null,
    attributes.gradingCompany ? `🏅 Grade : ${attributes.gradingCompany} ${attributes.grade ?? "à confirmer"}` : null,
    attributes.rawCondition ? `🧾 État raw : ${attributes.rawCondition}` : null,
    attributes.language !== "UNKNOWN" ? `🌐 Langue : ${attributes.language}` : null,
    attributes.isRecentRelease ? `🆕 Sortie mise en avant : ${attributes.releaseYear}` : null
  ].filter((line): line is string => Boolean(line));
}
