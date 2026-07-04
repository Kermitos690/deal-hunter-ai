import { describe, expect, it } from "vitest";
import { actualProfit, dealLifecycleSchema, estimateAccuracy } from "@/lib/deals/lifecycle";

describe("deal lifecycle", () => {
  it("exige les prix nécessaires selon le statut", () => {
    expect(dealLifecycleSchema.safeParse({ status: "purchased" }).success).toBe(false);
    expect(dealLifecycleSchema.safeParse({ status: "sold", actualBuyPrice: 500 }).success).toBe(false);
    expect(dealLifecycleSchema.safeParse({ status: "saved" }).success).toBe(true);
  });

  it("calcule le bénéfice réel et l'écart à l'estimation", () => {
    const profit = actualProfit({
      status: "sold", actualBuyPrice: 500, actualSalePrice: 800, actualFees: 80
    });
    expect(profit).toBe(220);
    expect(estimateAccuracy(250, profit!)).toEqual({
      difference: -30, absoluteError: 30, errorPercent: 12
    });
  });
});
