import { describe, expect, it } from "vitest";
import {
  channelTargetsForDeal,
  safeSponsoredDestination,
  sponsoredPlacementsAllowedForPlan,
  validateSponsoredCampaignInput
} from "@/lib/channels/rules";
import type { DealScore, ProductCandidate } from "@/types";

const score = (changes: Partial<DealScore> = {}): DealScore => ({
  totalScore: 82,
  marginScore: 80,
  liquidityScore: 80,
  riskScore: 80,
  conditionScore: 80,
  urgencyScore: 60,
  estimatedBuyCost: 100,
  estimatedResalePrice: 180,
  estimatedNetProfit: 55,
  estimatedRoiPercent: 55,
  recommendation: "BUY",
  scoringVersion: "v5",
  marketConfidence: "HIGH",
  comparableCount: 10,
  reasons: [],
  warnings: [],
  ...changes
});

const candidate = (changes: Partial<ProductCandidate> = {}): ProductCandidate => ({
  source: "ebay",
  sourceItemId: "tcg-1",
  title: "Pokemon Prismatic Evolutions Umbreon PSA 10",
  category: "Cartes à collectionner",
  priceAmount: 100,
  priceCurrency: "CHF",
  productUrl: "https://example.test/card",
  imageUrls: [],
  verticalAttributes: {
    franchise: "pokemon",
    productType: "GRADED_CARD",
    releaseYear: 2025
  },
  ...changes
});

describe("curated channels", () => {
  it("publie une carte Pokémon récente gradée dans les canaux compatibles", () => {
    const targets = channelTargetsForDeal(candidate(), score()).map((target) => target.slug);
    expect(targets).toContain("pokemon-general");
    expect(targets).toContain("pokemon-2025-2026");
    expect(targets).toContain("pokemon-graded");
    expect(targets).not.toContain("pokemon-sealed");
  });

  it("publie les lots dans le canal boutiques", () => {
    const targets = channelTargetsForDeal(candidate({
      title: "Pokemon collection binder lot",
      verticalAttributes: { franchise: "pokemon", productType: "LOT_COLLECTION" }
    }), score()).map((target) => target.slug);
    expect(targets).toContain("pokemon-boutiques");
  });

  it("ne publie jamais une opportunité évitée ou sans marge minimale", () => {
    expect(channelTargetsForDeal(candidate(), score({ recommendation: "AVOID" }))).toEqual([]);
    expect(channelTargetsForDeal(candidate(), score({ estimatedNetProfit: 24 }))).toEqual([]);
  });

  it("route les montres sans appliquer de règle Pokémon", () => {
    const targets = channelTargetsForDeal(candidate({
      title: "Omega Seamaster vintage watch",
      category: "Montres",
      verticalAttributes: undefined
    }), score()).map((target) => target.slug);
    expect(targets).toEqual(["montres-opportunites"]);
  });
});

describe("sponsored placements", () => {
  it("affiche les sponsors aux comptes Free mais garde les plans payants sans publicité par défaut", () => {
    expect(sponsoredPlacementsAllowedForPlan("free", { enabled: true })).toBe(true);
    expect(sponsoredPlacementsAllowedForPlan("pro", { enabled: true })).toBe(false);
    expect(sponsoredPlacementsAllowedForPlan("business", { enabled: true, showOnPaidPlans: true })).toBe(true);
    expect(sponsoredPlacementsAllowedForPlan("free", { enabled: false })).toBe(false);
  });

  it("refuse les destinations non web", () => {
    expect(safeSponsoredDestination("javascript:alert(1)")).toBeNull();
    expect(safeSponsoredDestination("https://shop.example.test/pokemon")).toBe("https://shop.example.test/pokemon");
  });

  it("valide les dates, limites et disclosure séparée", () => {
    const valid = validateSponsoredCampaignInput({
      sponsorName: "Boutique TCG",
      name: "Lancement juillet",
      headline: "Précommandes Pokémon",
      destinationUrl: "https://shop.example.test/preorders",
      startsAt: "2026-07-15T10:00:00Z",
      endsAt: "2026-08-15T10:00:00Z",
      dailyFrequencyCap: 1
    });
    expect(valid.valid).toBe(true);

    const invalid = validateSponsoredCampaignInput({
      sponsorName: "X",
      name: "X",
      headline: "Ad",
      destinationUrl: "data:text/html,bad",
      startsAt: "2026-08-15T10:00:00Z",
      endsAt: "2026-07-15T10:00:00Z",
      dailyFrequencyCap: 50
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.length).toBeGreaterThanOrEqual(4);
  });
});
