import type { ProductCandidate, Radar, SourceAdapter } from "@/types";

export const mockCandidates: ProductCandidate[] = [
  {
    source: "mock",
    sourceItemId: "lv-wallet-b-001",
    title: "Louis Vuitton portefeuille Monogram grade B",
    brand: "Louis Vuitton",
    model: "Porte-cartes",
    category: "maroquinerie",
    priceAmount: 125,
    priceCurrency: "CHF",
    buyNowPrice: 125,
    saleType: "BUY_NOW",
    shippingCost: 12,
    conditionText: "Usure légère, photos détaillées",
    conditionGrade: "B",
    sellerName: "Maison Vintage",
    sellerRating: "98.8%",
    sellerCountry: "CH",
    itemCountry: "CH",
    productUrl: "https://example.com/mock/lv-wallet-b-001",
    imageUrls: ["https://images.unsplash.com/photo-1627123424574-724758594e93?w=1200"],
    description: "Portefeuille seconde main avec marquage et photos intérieures."
  },
  {
    source: "mock",
    sourceItemId: "tag-vintage-002",
    title: "TAG Heuer Professional automatique vintage",
    brand: "TAG Heuer",
    model: "Professional 2000",
    category: "montres",
    priceAmount: 620,
    priceCurrency: "CHF",
    currentBidPrice: 620,
    auctionEndAt: new Date(Date.now() + 4 * 3_600_000).toISOString(),
    saleType: "AUCTION",
    conditionGrade: "B",
    sellerRating: "99.2%",
    sellerCountry: "DE",
    itemCountry: "DE",
    productUrl: "https://example.com/mock/tag-vintage-002",
    imageUrls: ["https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=1200"],
    description: "Fonctionnelle, révision inconnue, authenticité à vérifier."
  },
  {
    source: "mock",
    sourceItemId: "omega-repair-003",
    title: "Omega Seamaster vintage à réparer",
    brand: "Omega",
    model: "Seamaster vintage",
    category: "montres",
    priceAmount: 340,
    priceCurrency: "CHF",
    saleType: "BUY_NOW",
    conditionGrade: "REPAIR",
    sellerCountry: "JP",
    itemCountry: "JP",
    productUrl: "https://example.com/mock/omega-repair-003",
    imageUrls: ["https://images.unsplash.com/photo-1547996160-81dfa63595aa?w=1200"],
    description: "Mouvement arrêté. Pièces et coûts de remise en état à confirmer."
  },
  {
    source: "mock",
    sourceItemId: "japan-lot-004",
    title: "Lot B2B maroquinerie Japon grade B/C",
    category: "maroquinerie",
    priceAmount: 900,
    priceCurrency: "CHF",
    saleType: "BUY_NOW",
    conditionGrade: "C",
    sellerName: "Japan Wholesale",
    sellerRating: "Professional",
    sellerCountry: "JP",
    itemCountry: "JP",
    productUrl: "https://example.com/mock/japan-lot-004",
    imageUrls: ["https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=1200"],
    description: "Lot de 10 pièces, états variables, import et douane à calculer."
  }
];

function searchable(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

function matches(radar: Radar, item: ProductCandidate) {
  const text = searchable(`${item.title} ${item.brand ?? ""} ${item.model ?? ""}`);
  const category = searchable(radar.category);
  if (category && !text.includes(category)) {
    if (searchable(item.category ?? "") !== category) return false;
  }
  if (radar.brands.length && !radar.brands.some((brand) => text.includes(searchable(brand))))
    return false;
  if (radar.models.length && !radar.models.some((model) => text.includes(searchable(model))))
    return false;
  if (radar.include_keywords.length && !radar.include_keywords.every((word) => text.includes(searchable(word))))
    return false;
  if (radar.exclude_keywords.some((word) => text.includes(searchable(word)))) return false;
  return true;
}

export const mockAdapter: SourceAdapter = {
  name: "mock",
  enabled: process.env.ENABLE_MOCK_SOURCE !== "false",
  async scan(radar) {
    return mockCandidates.filter((item) => matches(radar, item));
  }
};
