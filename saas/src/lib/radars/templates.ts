import type { ConditionGrade } from "@/types";

export type RadarTemplate = {
  id: string;
  title: string;
  description: string;
  category: string;
  brands: string[];
  models?: string[];
  include_keywords: string[];
  exclude_keywords: string[];
  accepted_conditions: ConditionGrade[];
  sale_types: string[];
  min_roi_percent: number;
  min_profit: number;
};

export const RADAR_TEMPLATES: RadarTemplate[] = [
  {
    id: "lv-vintage",
    title: "Louis Vuitton vintage B/C",
    description: "Pièces vintage avec défauts revendables.",
    category: "Sacs et accessoires",
    brands: ["Louis Vuitton"],
    include_keywords: ["vintage"],
    exclude_keywords: ["fake", "replica", "inspired"],
    accepted_conditions: ["B", "C"],
    sale_types: ["BUY_NOW", "AUCTION"],
    min_roi_percent: 20,
    min_profit: 80
  },
  {
    id: "japan-watches",
    title: "Montres japonaises sous-cotées",
    description: "Montres d’occasion provenant du Japon.",
    category: "Montres",
    brands: ["Seiko", "Citizen", "Orient"],
    include_keywords: [],
    exclude_keywords: ["replica", "parts only"],
    accepted_conditions: ["A", "B", "C", "REPAIR"],
    sale_types: ["BUY_NOW", "AUCTION"],
    min_roi_percent: 20,
    min_profit: 60
  },
  {
    id: "luxury-lots",
    title: "Lots luxe grade B/C",
    description: "Lots à trier pour revente unitaire.",
    category: "Sacs et accessoires",
    brands: [],
    include_keywords: ["lot"],
    exclude_keywords: ["replica", "inspired"],
    accepted_conditions: ["B", "C"],
    sale_types: ["BUY_NOW", "AUCTION"],
    min_roi_percent: 25,
    min_profit: 150
  },
  {
    id: "repair-premium",
    title: "Accessoires premium à retaper",
    description: "Produits réparables avec marge prudente.",
    category: "Sacs et accessoires",
    brands: [],
    include_keywords: ["repair"],
    exclude_keywords: ["replica"],
    accepted_conditions: ["C", "REPAIR"],
    sale_types: ["BUY_NOW", "AUCTION"],
    min_roi_percent: 30,
    min_profit: 100
  },
  {
    id: "ending-auctions",
    title: "Enchères finissant bientôt",
    description: "Enchères avec date de fin disponible.",
    category: "Montres",
    brands: [],
    include_keywords: [],
    exclude_keywords: ["replica"],
    accepted_conditions: ["A", "B", "C"],
    sale_types: ["AUCTION"],
    min_roi_percent: 15,
    min_profit: 50
  },
  {
    id: "low-risk-margin",
    title: "Marge après frais, risque faible",
    description: "Produits en bon état avec photos.",
    category: "Objets de collection",
    brands: [],
    include_keywords: [],
    exclude_keywords: ["fake", "replica", "damaged"],
    accepted_conditions: ["NEW", "A", "B"],
    sale_types: ["BUY_NOW"],
    min_roi_percent: 20,
    min_profit: 75
  },
  {
    id: "swiss-watch-reference",
    title: "Montres suisses avec référence",
    description: "Montres identifiables destinées à une valorisation précise.",
    category: "Montres",
    brands: ["Omega", "TAG Heuer", "Longines", "Tissot"],
    include_keywords: ["reference"],
    exclude_keywords: ["replica", "fake", "aftermarket"],
    accepted_conditions: ["A", "B", "C"],
    sale_types: ["BUY_NOW", "AUCTION"],
    min_roi_percent: 18,
    min_profit: 120
  },
  {
    id: "authenticated-luxury",
    title: "Luxe documenté, risque réduit",
    description: "Pièces avec facture, certificat ou authentification mentionnée.",
    category: "Sacs et accessoires",
    brands: ["Louis Vuitton", "Gucci", "Prada", "Hermès"],
    include_keywords: ["authentic", "certificate"],
    exclude_keywords: ["replica", "inspired", "no return"],
    accepted_conditions: ["NEW", "A", "B"],
    sale_types: ["BUY_NOW"],
    min_roi_percent: 15,
    min_profit: 100
  },
  {
    id: "pokemon-modern-2025-2026",
    title: "Pokémon — sorties 2025–2026",
    description: "Cartes, slabs et produits scellés des extensions récentes avec contrôle de volatilité.",
    category: "Cartes à collectionner",
    brands: ["Pokémon"],
    models: [
      "tcg:type:RAW_SINGLE", "tcg:type:GRADED_CARD", "tcg:type:SEALED_PRODUCT",
      "tcg:grader:PSA", "tcg:grader:BGS", "tcg:grader:CGC",
      "tcg:language:EN", "tcg:language:FR", "tcg:language:DE", "tcg:language:IT", "tcg:language:JP",
      "tcg:year:2025", "tcg:year:2026"
    ],
    include_keywords: [],
    exclude_keywords: ["proxy", "replica", "fake", "custom card", "orica", "digital code", "mystery pack"],
    accepted_conditions: ["NEW", "A", "B", "UNKNOWN"],
    sale_types: ["BUY_NOW", "AUCTION"],
    min_roi_percent: 18,
    min_profit: 25
  },
  {
    id: "pokemon-graded",
    title: "Pokémon gradées PSA/BGS/CGC",
    description: "Slabs authentifiables, grades 8 à 10, avec numéro de carte et langue.",
    category: "Cartes à collectionner",
    brands: ["Pokémon"],
    models: [
      "tcg:type:GRADED_CARD", "tcg:grader:PSA", "tcg:grader:BGS", "tcg:grader:CGC",
      "tcg:grader:SGC", "tcg:grader:ACE", "tcg:grader:PCA", "tcg:min-grade:8", "tcg:ungraded:false"
    ],
    include_keywords: [],
    exclude_keywords: ["proxy", "replica", "fake", "reholder", "custom slab"],
    accepted_conditions: ["A", "B", "UNKNOWN"],
    sale_types: ["BUY_NOW", "AUCTION"],
    min_roi_percent: 20,
    min_profit: 35
  },
  {
    id: "pokemon-sealed",
    title: "Pokémon scellé",
    description: "Displays, ETB, booster bundles, blisters, tins et cases non ouverts.",
    category: "Cartes à collectionner",
    brands: ["Pokémon"],
    models: [
      "tcg:type:SEALED_PRODUCT", "tcg:language:EN", "tcg:language:FR", "tcg:language:DE",
      "tcg:language:IT", "tcg:language:JP", "tcg:year:2025", "tcg:year:2026",
      "tcg:ungraded:false", "tcg:graded:false"
    ],
    include_keywords: ["sealed"],
    exclude_keywords: ["empty box", "boite vide", "opened", "resealed", "proxy", "fake"],
    accepted_conditions: ["NEW", "A", "UNKNOWN"],
    sale_types: ["BUY_NOW", "AUCTION"],
    min_roi_percent: 15,
    min_profit: 30
  },
  {
    id: "pokemon-vintage-raw",
    title: "Pokémon vintage raw",
    description: "Cartes non gradées anciennes, éditions, promos et holo avec état détaillé.",
    category: "Cartes à collectionner",
    brands: ["Pokémon"],
    models: [
      "tcg:type:RAW_SINGLE", "tcg:year:1996", "tcg:year:1997", "tcg:year:1998",
      "tcg:year:1999", "tcg:year:2000", "tcg:year:2001", "tcg:year:2002", "tcg:year:2003",
      "tcg:graded:false"
    ],
    include_keywords: [],
    exclude_keywords: ["proxy", "replica", "fake", "custom card", "gold metal card"],
    accepted_conditions: ["A", "B", "C", "UNKNOWN"],
    sale_types: ["BUY_NOW", "AUCTION"],
    min_roi_percent: 25,
    min_profit: 40
  },
  {
    id: "pokemon-shop-lots",
    title: "Pokémon lots pour boutique",
    description: "Collections, classeurs et lots à trier pour revente unitaire en magasin ou en ligne.",
    category: "Cartes à collectionner",
    brands: ["Pokémon"],
    models: [
      "tcg:type:LOT_COLLECTION", "tcg:language:EN", "tcg:language:FR",
      "tcg:language:DE", "tcg:language:IT", "tcg:language:JP"
    ],
    include_keywords: ["lot"],
    exclude_keywords: ["proxy", "replica", "fake", "digital code", "energy only"],
    accepted_conditions: ["A", "B", "C", "UNKNOWN"],
    sale_types: ["BUY_NOW", "AUCTION"],
    min_roi_percent: 30,
    min_profit: 100
  }
];

export function radarTemplate(id?: string) {
  return RADAR_TEMPLATES.find((template) => template.id === id);
}
