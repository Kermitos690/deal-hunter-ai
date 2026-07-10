const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .toLowerCase()
  .replace(/&/g, " and ")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const unique = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))];

type AliasGroup = {
  canonical: string;
  aliases: string[];
};

const ALIAS_GROUPS: AliasGroup[] = [
  { canonical: "Pepsi", aliases: ["pepsi", "blro", "blue red", "red blue", "bleu rouge", "rouge bleu"] },
  { canonical: "Coke", aliases: ["coke", "coca cola", "coca-cola", "cola", "red black", "black red", "rouge noir", "noir rouge", "16760"] },
  { canonical: "Batman", aliases: ["batman", "blnr", "blue black", "black blue", "bleu noir", "noir bleu"] },
  { canonical: "Batgirl", aliases: ["batgirl", "jubilee blnr"] },
  { canonical: "Root Beer", aliases: ["root beer", "rootbeer", "chnr", "brown black", "black brown", "brun noir", "noir brun"] },
  { canonical: "Sprite", aliases: ["sprite", "vtnr", "green black", "black green", "vert noir", "noir vert"] },
  { canonical: "Hulk", aliases: ["hulk", "116610lv", "green submariner", "submariner green", "submariner vert"] },
  { canonical: "Kermit", aliases: ["kermit", "16610lv"] },
  { canonical: "Starbucks", aliases: ["starbucks", "126610lv"] },
  { canonical: "GMT-Master II", aliases: ["gmt master ii", "gmt-master ii", "gmt master 2", "gmt-master 2", "gmt ii"] },
  { canonical: "Day-Date", aliases: ["day date", "day-date", "president", "presidential"] },
  { canonical: "Oyster Perpetual", aliases: ["oyster perpetual", "oyster-perpetual"] },
  { canonical: "Yacht-Master", aliases: ["yacht master", "yacht-master"] },
  { canonical: "Sea-Dweller", aliases: ["sea dweller", "sea-dweller"] },
  { canonical: "Sky-Dweller", aliases: ["sky dweller", "sky-dweller"] },
  { canonical: "Royal Oak", aliases: ["royal oak", "royaloak"] },
  { canonical: "Nautilus", aliases: ["nautilus"] },
  { canonical: "Aquanaut", aliases: ["aquanaut"] },
  { canonical: "Black Bay", aliases: ["black bay", "blackbay"] }
];

const ALIAS_TO_GROUP = new Map<string, AliasGroup>();
for (const group of ALIAS_GROUPS) {
  ALIAS_TO_GROUP.set(normalize(group.canonical), group);
  for (const alias of group.aliases) ALIAS_TO_GROUP.set(normalize(alias), group);
}

function containsPhrase(normalizedText: string, rawPhrase: string) {
  const phrase = normalize(rawPhrase);
  if (!phrase) return false;
  if (` ${normalizedText} `.includes(` ${phrase} `)) return true;
  if (/^[a-z]{3,5}$/.test(phrase)) {
    return new RegExp(`\\b[a-z0-9]*${phrase}\\b`).test(normalizedText);
  }
  return false;
}

export function canonicalSearchTerm(value: string) {
  return ALIAS_TO_GROUP.get(normalize(value))?.canonical ?? value.trim();
}

export function searchTermAlternatives(value: string) {
  const alternatives = value.split("|").flatMap((entry) => {
    const clean = entry.trim();
    if (!clean) return [];
    const group = ALIAS_TO_GROUP.get(normalize(clean));
    return group ? [group.canonical, ...group.aliases] : [clean];
  });
  return unique(alternatives);
}

export function matchesSearchTerm(text: string, term: string) {
  const haystack = normalize(text);
  if (!haystack || !term.trim()) return false;
  return searchTermAlternatives(term).some((alternative) => {
    if (containsPhrase(haystack, alternative)) return true;
    const tokens = normalize(alternative).split(" ").filter(Boolean);
    return tokens.length > 1 && tokens.every((token) => containsPhrase(haystack, token));
  });
}

export function matchesAnySearchTerm(text: string, terms: string[]) {
  return terms.some((term) => matchesSearchTerm(text, term));
}

export function matchesAllSearchTerms(text: string, terms: string[]) {
  return terms.every((term) => matchesSearchTerm(text, term));
}

export function isWatchCategory(category: string) {
  return /^(montre|montres|watch|watches|uhr|uhren)$/.test(normalize(category));
}

const CATALOGUE_TERMS = [
  "catalog", "catalogue", "brochure", "book", "magazine", "manual", "instruction manual",
  "poster", "advert", "advertising", "press kit", "price list", "dealer display"
];

const HARD_ACCESSORY_TERMS = [
  "watch strap", "watch band", "strap", "band", "bracelet", "buckle", "clasp",
  "dial", "cadran", "bezel", "lunette", "movement", "mouvement", "caliber", "calibre",
  "watch case", "boitier", "crown", "couronne", "hands", "aiguilles", "crystal", "verre",
  "spring bar", "end link"
];

const ACCESSORY_PRODUCT_PHRASES = [
  "watch strap", "watch band", "replacement strap", "replacement bracelet", "spare strap", "spare bracelet",
  "strap for", "bracelet for", "band for", "fits rolex", "fits omega", "fits tag heuer"
];

const SOFT_ACCESSORY_TERMS = [
  "empty box", "watch box", "boite", "box", "papers", "certificate", "hang tag", "pouch"
];

const EXCLUSIVE_ACCESSORY_TERMS = [
  "only", "seul", "seule", "empty", "vide", "replacement", "spare", "parts", "part only",
  "compatible", "fits", "fit for", "watch not included", "without watch", "sans montre", "no watch"
];

const WATCH_PRODUCT_TERMS = [
  "wristwatch", "watch", "montre", "uhr", "orologio", "reloj", "armbanduhr", "腕時計"
];

const WATCH_MODEL_TERMS = [
  "daytona", "submariner", "gmt master", "datejust", "oyster perpetual", "explorer", "yacht master",
  "sea dweller", "sky dweller", "day date", "air king", "cellini", "seamaster", "speedmaster",
  "constellation", "de ville", "navitimer", "superocean", "chronomat", "carrera", "monaco",
  "aquaracer", "formula 1", "royal oak", "nautilus", "aquanaut", "black bay", "pelagos",
  "hydroconquest", "dolcevita", "t touch", "eco drive", "promaster"
];

const WATCH_FUNCTION_TERMS = [
  "automatic", "automatique", "quartz", "mechanical", "mecanique", "chronograph", "chronographe",
  "chronometer", "chronometre", "self winding", "hand wound", "hand winding", "solar", "kinetic",
  "eco drive", "jewels", "diver", "divers", "gmt"
];

function containsAny(normalizedText: string, values: string[]) {
  return values.some((value) => containsPhrase(normalizedText, value));
}

function hasWatchReference(normalizedText: string) {
  return /\b(?:[a-z]{0,5}\d[a-z0-9]{3,}|\d{4,6}[a-z]{0,5})\b/.test(normalizedText);
}

export function looksLikeCompleteWatchTitle(title: string, expectedTerms: string[] = []) {
  const value = normalize(title);
  if (!value || containsAny(value, CATALOGUE_TERMS)) return false;

  const accessoryProduct = containsAny(value, ACCESSORY_PRODUCT_PHRASES);
  const hardAccessory = containsAny(value, HARD_ACCESSORY_TERMS);
  const softAccessory = containsAny(value, SOFT_ACCESSORY_TERMS);
  const exclusiveAccessory = containsAny(value, EXCLUSIVE_ACCESSORY_TERMS);
  const explicitWatch = containsAny(value, WATCH_PRODUCT_TERMS);

  if (accessoryProduct) return false;
  if ((hardAccessory || softAccessory) && exclusiveAccessory) return false;

  const modelSignal = containsAny(value, WATCH_MODEL_TERMS);
  const functionSignal = containsAny(value, WATCH_FUNCTION_TERMS);
  const expectedSignal = expectedTerms.length > 0 && matchesAnySearchTerm(title, expectedTerms);
  if (hardAccessory && !explicitWatch && !functionSignal) return false;

  return explicitWatch || modelSignal || functionSignal || (expectedSignal && hasWatchReference(value));
}
