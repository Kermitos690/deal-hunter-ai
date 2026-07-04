import { describe, expect, it } from "vitest";
import { calculateResaleScenarios } from "@/scoring/resale-scenarios";

describe("calculateResaleScenarios", () => {
  it("ventile les coûts et produit trois scénarios cohérents", () => {
    const result = calculateResaleScenarios({
      itemPrice: 500,
      shippingCost: 20,
      customsCost: 10,
      repairCost: 50,
      vatRate: 0.081,
      platformFeeRate: 0.1,
      paymentFeeRate: 0.03,
      marketLow: 700,
      marketMedian: 800,
      marketHigh: 950,
      targetProfit: 100
    });

    expect(result.costs.totalBuyCost).toBe(626.98);
    expect(result.totalSaleFeeRate).toBe(13);
    expect(result.scenarios).toHaveLength(3);
    expect(result.scenarios[0].netProfit).toBeLessThan(result.scenarios[1].netProfit);
    expect(result.scenarios[1].netProfit).toBeLessThan(result.scenarios[2].netProfit);
    expect(result.breakEvenResalePrice).toBeCloseTo(720.67, 2);
    expect(result.maxItemPriceForTargetProfit).toBeCloseTo(471.34, 2);
  });

  it("ne propose jamais un prix d'achat maximum négatif", () => {
    const result = calculateResaleScenarios({
      itemPrice: 100,
      shippingCost: 100,
      customsCost: 100,
      repairCost: 100,
      vatRate: 0.1,
      platformFeeRate: 0.5,
      paymentFeeRate: 0.2,
      marketLow: 100,
      marketMedian: 100,
      marketHigh: 100,
      targetProfit: 500
    });

    expect(result.maxItemPriceForTargetProfit).toBe(0);
  });
});
