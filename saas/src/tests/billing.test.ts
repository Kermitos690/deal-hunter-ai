import { afterEach, describe, expect, it } from "vitest";
import { planForStripePrice, stripePriceForPlan } from "@/lib/billing/stripe";

describe("facturation", () => {
  afterEach(() => {
    delete process.env.STRIPE_PRO_PRICE_ID;
    delete process.env.STRIPE_BUSINESS_PRICE_ID;
  });

  it("associe strictement les Price IDs aux plans", () => {
    process.env.STRIPE_PRO_PRICE_ID = "price_pro";
    process.env.STRIPE_BUSINESS_PRICE_ID = "price_business";
    expect(stripePriceForPlan("pro")).toBe("price_pro");
    expect(planForStripePrice("price_business")).toBe("business");
    expect(planForStripePrice("price_unknown")).toBe("free");
  });
});
