import { canonicalSearchTerm, matchesSearchTerm, searchTermAlternatives } from "@/lib/search-precision";

type CategoryProfile = {
  label: string;
  examples: string[];
  brands: string[];
  models: string[];
  keywords: string[];
  excludeKeywords: string[];
  aliases: Record<string, string>;
};

export type SearchIntent = {
  brands: string[];
  models: string[];
  includeKeywords: string[];
  excludeKeywords: string[];
};

const CATEGORY_PROFILES: Record<string, CategoryProfile> = {
  "montres": {
    label: "Montres",
    examples: ["Rolex GMT-Master II Pepsi", "Rolex Daytona 116500LN", "Omega Seamaster quartz", "Cartier Must Tank", "Tudor Black Bay", "Seiko vintage"],
    brands: [
      "Omega", "TAG Heuer", "Rolex", "Tissot", "Longines", "Cartier", "Breitling", "Tudor", "Seiko",
      "Citizen", "Orient", "Rado", "Ebel", "Hamilton", "IWC", "Jaeger-LeCoultre", "Audemars Piguet",
      "Patek Philippe", "Vacheron Constantin", "Panerai", "Hublot", "Zenith", "Grand Seiko", "Blancpain", "Breguet"
    ],
    models: [
      "Daytona", "Submariner", "GMT-Master", "GMT-Master II", "Datejust", "Oyster Perpetual", "Explorer",
      "Explorer II", "Yacht-Master", "Sea-Dweller", "Sky-Dweller", "Day-Date", "Air-King", "Cellini",
      "Seamaster", "Speedmaster", "De Ville", "Constellation", "Professional", "Formula 1", "Link", "Carrera",
      "Monaco", "Aquaracer", "Tank", "Santos", "Must", "DolceVita", "HydroConquest", "T-Touch", "Royal Oak",
      "Nautilus", "Aquanaut", "Black Bay", "Pelagos", "Navitimer", "Superocean", "Chronomat", "Eco-Drive", "Promaster"
    ],
    keywords: [
      "Pepsi", "Coke", "Batman", "Batgirl", "Root Beer", "Sprite", "Hulk", "Kermit", "Starbucks",
      "quartz", "automatique", "vintage", "full set", "boîte", "papiers", "révision", "fonctionne",
      "acier", "or", "chronographe"
    ],
    excludeKeywords: [
      "fake", "replica", "inspired", "homage", "bracelet seul", "boîte seule", "cadran seul", "parts only",
      "catalogue", "brochure", "manual only", "movement only", "bezel only"
    ],
    aliases: {
      "tag heuer": "TAG Heuer", "tagheur": "TAG Heuer", "tagueur": "TAG Heuer", "tag": "TAG Heuer",
      "omega": "Omega", "oméga": "Omega", "rolex": "Rolex", "olex": "Rolex", "rolllex": "Rolex",
      "tissot": "Tissot", "tudor": "Tudor", "cartié": "Cartier", "cartier": "Cartier",
      "longine": "Longines", "longines": "Longines", "ap": "Audemars Piguet", "audemars": "Audemars Piguet",
      "patek": "Patek Philippe", "jlc": "Jaeger-LeCoultre", "grand seiko": "Grand Seiko"
    }
  },
  "sacs et accessoires": {
    label: "Sacs et accessoires",
    examples: ["Louis Vuitton Speedy", "Prada nylon", "Gucci Jackie", "Fendi Baguette", "Hermès carré", "Dior Saddle"],
    brands: ["Louis Vuitton", "Chanel", "Prada", "Gucci", "Fendi", "Hermès", "Dior", "Celine", "Loewe", "Bottega Veneta", "Balenciaga", "Saint Laurent", "Miu Miu", "Goyard"],
    models: ["Speedy", "Neverfull", "Alma", "Keepall", "Jackie", "Marmont", "Baguette", "Peekaboo", "Saddle", "Lady Dior", "Puzzle", "Cassette", "Triomphe", "Cabas", "Kelly", "Birkin"],
    keywords: ["cuir", "toile", "monogram", "damier", "nylon", "vintage", "dustbag", "authentique", "petit défaut", "coin usé", "fermeture"],
    excludeKeywords: ["fake", "replica", "inspired", "style", "non authentique", "copie"],
    aliases: { "lv": "Louis Vuitton", "louis v": "Louis Vuitton", "louis vuitton": "Louis Vuitton", "vuitton": "Louis Vuitton", "vuiton": "Louis Vuitton", "hermes": "Hermès", "hermès": "Hermès", "celine": "Celine", "céline": "Celine", "ysl": "Saint Laurent" }
  },
  "sneakers": {
    label: "Sneakers",
    examples: ["Nike SB Dunk", "Air Jordan 1", "Adidas Samba", "New Balance 2002R", "Asics Gel-Kayano", "Patta Air Max"],
    brands: ["Nike", "Jordan", "Adidas", "New Balance", "Asics", "Salomon", "Puma", "Reebok", "Vans", "Converse", "Yeezy", "Patta", "Parra", "Supreme"],
    models: ["Dunk", "SB Dunk", "Air Jordan 1", "Air Max", "Samba", "Gazelle", "Campus", "Yeezy", "2002R", "990", "991", "Gel-Kayano", "Gel-Lyte", "XT-6"],
    keywords: ["deadstock", "DS", "neuf", "VNDS", "OG box", "taille", "collab", "limited", "worn once", "boîte", "facture"],
    excludeKeywords: ["fake", "replica", "ua", "unauthorized", "custom", "sans boîte"],
    aliases: { "jordan": "Jordan", "air jordan": "Jordan", "nike sb": "Nike", "nikesb": "Nike", "new balance": "New Balance", "nb": "New Balance", "yeezy": "Yeezy", "adidas": "Adidas", "addidas": "Adidas", "asics": "Asics", "patta": "Patta", "parra": "Parra" }
  },
  "bijoux": {
    label: "Bijoux",
    examples: ["Cartier Love", "Tiffany bracelet argent", "Bulgari B.zero1", "Van Cleef Alhambra", "Chopard Happy Diamonds", "Messika diamant"],
    brands: ["Cartier", "Tiffany", "Bulgari", "Van Cleef & Arpels", "Chopard", "Chaumet", "Piaget", "Pomellato", "Boucheron", "Messika", "Dinh Van"],
    models: ["Love", "Juste un Clou", "Trinity", "Tank", "Alhambra", "B.zero1", "Serpenti", "Return to Tiffany", "Happy Diamonds", "Possession"],
    keywords: ["or", "argent", "750", "18k", "diamant", "certificat", "poinçon", "boîte", "facture", "taille", "bracelet", "bague", "collier"],
    excludeKeywords: ["plaqué", "fantaisie", "fake", "replica", "inspired", "style"],
    aliases: { "tifany": "Tiffany", "tiffany": "Tiffany", "bulgari": "Bulgari", "bvlgari": "Bulgari", "van cleef": "Van Cleef & Arpels", "vca": "Van Cleef & Arpels", "cartié": "Cartier", "cartier": "Cartier" }
  },
  "cartes à collectionner": {
    label: "Cartes à collectionner",
    examples: ["Pokémon PSA 10", "Magic sealed", "Yu-Gi-Oh vintage", "One Piece manga rare", "Lorcana enchanted", "Panini rookie"],
    brands: ["Pokémon", "Magic", "Yu-Gi-Oh", "One Piece", "Lorcana", "Panini", "Topps"],
    models: ["Charizard", "Dracaufeu", "Pikachu", "Evoli", "PSA", "BGS", "CGC", "1st edition", "Base Set", "sealed", "booster", "display", "ETB"],
    keywords: ["gradée", "graded", "PSA 10", "PSA 9", "sealed", "scellé", "booster", "display", "rare", "holo", "mint", "near mint"],
    excludeKeywords: ["proxy", "fake", "custom", "reprint", "lot vrac", "abîmée"],
    aliases: { "pokemon": "Pokémon", "pokémon": "Pokémon", "dracaufeu": "Pokémon", "charizard": "Pokémon", "yugioh": "Yu-Gi-Oh", "yu gi oh": "Yu-Gi-Oh", "mtg": "Magic", "magic": "Magic" }
  },
  "objets de collection": {
    label: "Objets de collection",
    examples: ["Swatch vintage", "LEGO sealed", "Bearbrick", "Supreme accessoire", "stylo Montblanc", "Baccarat cristal"],
    brands: ["Swatch", "LEGO", "Bearbrick", "Supreme", "Montblanc", "Zippo", "Lalique", "Baccarat", "Christofle"],
    models: ["MoonSwatch", "Scuba", "Fifty Fathoms", "Technic", "Star Wars", "Meisterstück", "limited edition", "collector"],
    keywords: ["scellé", "sealed", "vintage", "édition limitée", "numéroté", "boîte", "certificat", "neuf", "ancien"],
    excludeKeywords: ["fake", "replica", "incomplete", "cassé", "lot pièces"],
    aliases: { "lego": "LEGO", "swatch": "Swatch", "mont blanc": "Montblanc", "montblanc": "Montblanc", "bearbrick": "Bearbrick", "supreme": "Supreme" }
  }
};

const DEFAULT_PROFILE = CATEGORY_PROFILES["montres"];
const normalized=(value:string)=>value.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase().trim();
const unique = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))];
const STOP_WORDS = new Set(["et", "ou", "avec", "sans", "pour", "de", "du", "des", "la", "le", "les", "un", "une", "en", "a", "à", "the", "and", "or"]);
const ALL_BRAND_ALIASES = Object.values(CATEGORY_PROFILES).flatMap((profile) => [
  ...profile.brands.map((brand) => [normalized(brand), brand] as const),
  ...Object.entries(profile.aliases).map(([alias, brand]) => [normalized(alias), brand] as const)
]);
const FREE_TEXT_STOPWORDS = new Set([
  "je", "cherche", "recherche", "veux", "voudrais", "trouve", "trouver", "uniquement", "seulement",
  "montre", "montres", "watch", "watches", "modele", "model", "avec", "sans", "pour", "une", "un",
  "des", "de", "du", "la", "le", "les", "et", "ou", "or", "the", "only", "with", "for", "in", "en",
  "sur", "pas", "trop", "cher", "chere", "prix", "occasion", "annonce", "annonces"
]);

function profileFor(category?: string) {
  const key = normalized(category ?? "");
  return CATEGORY_PROFILES[key] ?? DEFAULT_PROFILE;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesTerm(haystack: string, term: string) {
  const needle = normalized(term);
  return needle.length > 1 && new RegExp(`(^|[^a-z0-9])${escapeRegex(needle)}([^a-z0-9]|$)`, "i").test(haystack);
}

function removeKnownTerms(value: string, terms: string[]) {
  return terms.reduce((text, term) => {
    const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(normalized(term))}([^a-z0-9]|$)`, "gi");
    return text.replace(pattern, " ");
  }, normalized(value)).replace(/\s+/g, " ").trim();
}

function manualKeywordCandidates(clean: string, knownTerms: string[]) {
  const residual = removeKnownTerms(clean, knownTerms);
  const chunks = [
    ...clean.split(/[,;\n/]+/),
    ...residual.split(/\s+/)
  ]
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 1)
    .filter((chunk) => !STOP_WORDS.has(normalized(chunk)))
    .filter((chunk) => !knownTerms.some((term) => includesTerm(normalized(chunk), term)));
  const sizesAndRefs = clean.match(/\b(?:taille\s*)?\d{2}(?:[.,]5)?\b|\b[A-Z]{1,5}[-\s]?\d{2,6}[A-Z]?\b/gi) ?? [];
  return unique([...chunks, ...sizesAndRefs]).slice(0, 12);
}

function normalizeManualKeyword(keyword: string, profile: CategoryProfile) {
  const value = normalized(keyword);
  if (profile.label === "Montres" && /^(revise|revisee|revisée|revision|révision|service|serviced)$/.test(value)) return "révision";
  if (profile.label === "Sneakers" && /^(ogbox|og box|boite og|boîte og)$/.test(value)) return "OG box";
  return keyword;
}

function brandsFromAllCategories(value: string) {
  const haystack = normalized(value);
  return unique(ALL_BRAND_ALIASES
    .map(([alias, brand]) => ({ alias, brand, index: haystack.search(new RegExp(`(^|[^a-z0-9])${escapeRegex(alias)}([^a-z0-9]|$)`, "i")) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map(({ brand }) => brand === "Hermes" ? "Hermès" : brand));
}

function removeDetectedTerms(value: string, terms: string[]) {
  let residue = ` ${normalized(value)} `;
  const alternatives = unique(terms.flatMap(searchTermAlternatives))
    .map(normalized)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const alternative of alternatives) {
    residue = residue.replace(new RegExp(`(^| )${escapeRegex(alternative)}(?= |$)`, "g"), " ");
  }
  return residue.replace(/\s+/g, " ").trim();
}

function residualKeywords(value: string, detectedTerms: string[]) {
  const references = value.match(/\b(?:[A-Za-z]{0,5}\d[A-Za-z0-9.-]{3,}|[A-Za-z]{2,5}\d{2,})\b/g) ?? [];
  const residue = removeDetectedTerms(value, [...detectedTerms, ...references]);
  const tokens = residue
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1)
    .filter((token) => !FREE_TEXT_STOPWORDS.has(token));
  return unique([...references, ...tokens].map(canonicalSearchTerm));
}

export function searchSuggestionsFor(category: string) {
  return profileFor(category).examples.slice(0, 6);
}

export function searchSuggestionAt(category: string, index: number) {
  return searchSuggestionsFor(category)[index] ?? null;
}

export function searchSuggestionKeyboard(category: string) {
  return {
    inline_keyboard: searchSuggestionsFor(category).map((example, index) => [
      { text: example, callback_data: `wizsearch:${index}` }
    ])
  };
}

export function categorySearchPrompt(category: string) {
  const profile = profileFor(category);
  return [
    `2/7 — Affine ton radar ${profile.label}`,
    "",
    "Choisis une proposition ou écris librement marque, modèle, référence et surnom.",
    "Chaque critère demandé sera vérifié dans l’annonce. Les accessoires seuls seront écartés.",
    "",
    "Tu peux écrire par exemple :",
    ...profile.examples.slice(0, 3).map((example) => `• ${example}`)
  ].join("\n");
}

export function parseSearchIntent(value:string, category?: string): SearchIntent {
  const profile = profileFor(category);
  const clean=value.trim().replace(/\s+/g," ");
  if(!clean) return { brands: [], models: [], includeKeywords: [], excludeKeywords: profile.excludeKeywords };
  const haystack=normalized(clean);
  const brandAliases = new Map<string, string>();
  for (const brand of profile.brands) brandAliases.set(normalized(brand), brand);
  for (const [alias, brand] of Object.entries(profile.aliases)) brandAliases.set(normalized(alias), brand);

  const brands = unique([...brandAliases.entries()]
    .filter(([alias]) => includesTerm(haystack, alias))
    .map(([, brand]) => brand));
  const detectedModels = unique(profile.models.filter((model) => matchesSearchTerm(clean, model)));
  const models = detectedModels.filter((model) => !detectedModels.some((other) =>
    other !== model && normalized(other).length > normalized(model).length && normalized(other).includes(normalized(model))
  ));
  const detectedKeywords = unique(profile.keywords
    .map(canonicalSearchTerm)
    .filter((keyword) => matchesSearchTerm(clean, keyword)));
  const hasAlternativeConnector = /\b(?:ou|or)\b|[|/]/i.test(clean);
  const aliasKeywords = detectedKeywords.filter((keyword) => searchTermAlternatives(keyword).length > 1);
  const strictKeywords = detectedKeywords.filter((keyword) => !aliasKeywords.includes(keyword));
  const keywordGroups = hasAlternativeConnector && aliasKeywords.length > 1
    ? [...strictKeywords, aliasKeywords.join("|")]
    : detectedKeywords;
  const typedKeywords = residualKeywords(clean, [...brands, ...models, ...detectedKeywords])
    .map((keyword) => canonicalSearchTerm(normalizeManualKeyword(keyword, profile)))
    .filter((keyword) => !FREE_TEXT_STOPWORDS.has(normalized(keyword)));
  const knownManualTerms = unique([
    ...brands,
    ...models,
    ...detectedKeywords,
    ...[...brandAliases.keys()]
  ].flatMap(searchTermAlternatives));
  const manualKeywords = manualKeywordCandidates(clean, knownManualTerms)
    .map((keyword) => canonicalSearchTerm(normalizeManualKeyword(keyword, profile)))
    .filter((keyword) => !FREE_TEXT_STOPWORDS.has(normalized(keyword)))
    .filter((keyword) => !typedKeywords.some((typed) => normalized(typed) === normalized(keyword)));
  const includeKeywords = unique([...keywordGroups, ...typedKeywords, ...manualKeywords].slice(0, 12));
  return { brands, models, includeKeywords, excludeKeywords: profile.excludeKeywords };
}

export function parseBrands(value:string, category?: string) {
  const intent = parseSearchIntent(value, category);
  if (intent.brands.length) return intent.brands;
  const globalBrands = brandsFromAllCategories(value);
  if (globalBrands.length) return globalBrands;
  return unique(value.split(/[,;\n]+/).map((brand)=>brand.trim()).filter(Boolean));
}

export function positiveNumber(value:string) {
  const number=Number(value.replace(/['\s]/g,"").replace(",","."));
  return Number.isFinite(number)&&number>0?number:null;
}

export const categoryKeyboard = { inline_keyboard:[
  [{text:"⌚ Montres",callback_data:"wizcat:Montres"},{text:"👜 Sacs",callback_data:"wizcat:Sacs et accessoires"}],
  [{text:"👟 Sneakers",callback_data:"wizcat:Sneakers"},{text:"💎 Bijoux",callback_data:"wizcat:Bijoux"}],
  [{text:"🃏 Cartes",callback_data:"wizcat:Cartes à collectionner"},{text:"🏺 Collection",callback_data:"wizcat:Objets de collection"}]
]};
export const conditionKeyboard = { inline_keyboard:[
  [{text:"✨ Neuf + excellent",callback_data:"wizcond:NEW,A"},{text:"👍 Bon état",callback_data:"wizcond:A,B"}],
  [{text:"🛠 Usagé / réparation",callback_data:"wizcond:B,C,REPAIR"},{text:"🌐 Tous les états",callback_data:"wizcond:NEW,A,B,C,REPAIR,UNKNOWN"}]
]};
export const TELEGRAM_SOURCE_OPTIONS = [
  { id: "ebay", label: "🌍 eBay mondial", recommended: true },
  { id: "komehyo", label: "🇯🇵 KOMEHYO", recommended: true },
  { id: "tutti", label: "🇨🇭 Tutti", recommended: true },
  { id: "email-alerts", label: "📩 Alertes email", recommended: true },
  { id: "rss", label: "📰 RSS", recommended: false },
  { id: "ricardo", label: "🇨🇭 Ricardo bêta", recommended: false },
  { id: "anibis", label: "🇨🇭 Anibis bêta", recommended: false }
] as const;

export function recommendedTelegramSources() {
  return TELEGRAM_SOURCE_OPTIONS.filter((source) => source.recommended).map((source) => source.id);
}

export function sourceSelectionKeyboard(selected: string[] = recommendedTelegramSources()) {
  const selectedSet = new Set(selected);
  return {
    inline_keyboard: [
      [{ text: "✅ Pack recommandé", callback_data: "wizsrcpreset:recommended" }],
      ...TELEGRAM_SOURCE_OPTIONS.map((source) => [
        { text: `${selectedSet.has(source.id) ? "✅" : "⬜"} ${source.label}`, callback_data: `wizsrctoggle:${source.id}` }
      ]),
      [{ text: "➡️ Continuer", callback_data: "wizsrcdone" }]
    ]
  };
}

export const sourceKeyboard = sourceSelectionKeyboard();
export const frequencyKeyboard = { inline_keyboard:[
  [{text:"Toutes les 6 h",callback_data:"wizfreq:360"},{text:"Toutes les 12 h",callback_data:"wizfreq:720"}],
  [{text:"Une fois par jour",callback_data:"wizfreq:1440"}]
]};
