import { describe, expect, it } from "vitest";
import { candidateMatchesRadar, estimatedLandedCost, scoreMatchesRadar } from "@/lib/scans/radar-filters";
import { mockCandidates } from "@/sources/mock.adapter";
import { radar } from "./fixtures";
import type { DealScore, Radar } from "@/types";

const configured = (changes: Partial<Radar> = {}): Radar => ({
  ...radar,
  accepted_conditions: ["NEW","A","B","C","REPAIR","UNKNOWN"],
  photos_required: false,
  max_buy_price: 10_000,
  brands: [],
  models: [],
  include_keywords: [],
  exclude_keywords: [],
  source_countries: [],
  sale_types: ["BUY_NOW","AUCTION"],
  ...changes
});

describe("radar filters", () => {
  it("applique mots inclus, mots exclus, marque et modèle", () => {
    const candidate = mockCandidates[0];
    expect(candidateMatchesRadar(candidate, configured({ brands:["Louis Vuitton"], models:["Porte-cartes"], include_keywords:["Monogram"] }))).toBe(true);
    expect(candidateMatchesRadar(candidate, configured({ exclude_keywords:["portefeuille"] }))).toBe(false);
    expect(candidateMatchesRadar(candidate, configured({ brands:["Omega"] }))).toBe(false);
  });

  it("applique photos et états", () => {
    const candidate = { ...mockCandidates[0], imageUrls: [] };
    expect(candidateMatchesRadar(candidate, configured({ photos_required:true }))).toBe(false);
    expect(candidateMatchesRadar(mockCandidates[0], configured({ accepted_conditions:["A"] }))).toBe(false);
  });

  it("applique pays, UE et type de vente lorsque connus", () => {
    expect(candidateMatchesRadar(mockCandidates[1], configured({ source_countries:["EU"], sale_types:["AUCTION"] }))).toBe(true);
    expect(candidateMatchesRadar(mockCandidates[1], configured({ source_countries:["CH"] }))).toBe(false);
    expect(candidateMatchesRadar(mockCandidates[1], configured({ sale_types:["BUY_NOW"] }))).toBe(false);
  });

  it("applique le budget total au coût rendu", () => {
    const candidate = mockCandidates[0];
    const withCosts = configured({ total_budget:150, shipping_cost:10, customs_cost:5, repair_cost:5, vat_rate:0.1 });
    expect(estimatedLandedCost(candidate, withCosts)).toBeCloseTo(161.7);
    expect(candidateMatchesRadar(candidate, withCosts)).toBe(false);
  });

  it("applique score, bénéfice et ROI comme seuils stricts", () => {
    const score = {
      totalScore:75, estimatedNetProfit:60, estimatedRoiPercent:20
    } as DealScore;
    expect(scoreMatchesRadar(score, configured({ min_score:70, min_profit:50, min_roi_percent:15 }))).toBe(true);
    expect(scoreMatchesRadar(score, configured({ min_score:80 }))).toBe(false);
    expect(scoreMatchesRadar(score, configured({ min_profit:70 }))).toBe(false);
    expect(scoreMatchesRadar(score, configured({ min_roi_percent:25 }))).toBe(false);
  });
});
