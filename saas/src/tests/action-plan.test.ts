import { describe, expect, it } from "vitest";
import { buildDealActionPlan } from "@/scoring/action-plan";
import { radar } from "./fixtures";
import type { ProductCandidate } from "@/types";

const watch: ProductCandidate = {
  source: "ebay", sourceItemId: "omega", title: "Omega Seamaster",
  category: "Montres", priceAmount: 600, priceCurrency: "CHF",
  shippingCost: 20, conditionGrade: "B", productUrl: "https://example.com", imageUrls: ["x"]
};

describe("buildDealActionPlan", () => {
  it("calcule une offre plafond après frais et bénéfice cible", () => {
    const plan = buildDealActionPlan(watch, { ...radar, min_profit: 100 }, 1000, "HIGH");
    expect(plan.maximumOffer).toBe(730);
    expect(plan.breakEvenResalePrice).toBeCloseTo(729.41, 2);
    expect(plan.recommendedChannel).toContain("Chrono24");
    expect(plan.action).toContain("730 CHF");
  });

  it("allonge l'horizon si les données et l'état sont faibles", () => {
    const plan = buildDealActionPlan({ ...watch, conditionGrade: "REPAIR" }, radar, 1000, "LOW");
    expect(plan.estimatedSaleDays).toBe(75);
  });
});
