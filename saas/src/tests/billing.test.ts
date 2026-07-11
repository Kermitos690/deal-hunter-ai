import { afterEach, describe, expect, it } from "vitest";
import { manualSubscriptionState } from "@/lib/billing/admin-subscriptions";
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

  it("synchronise un abonnement manuel administrateur", () => {
    expect(manualSubscriptionState({ userId: "user-1", plan: "pro", userStatus: "active" })).toEqual(expect.objectContaining({
      provider: "manual_admin",
      customer_id: "manual:user-1",
      subscription_id: "manual:user-1",
      plan: "pro",
      status: "active"
    }));
    expect(manualSubscriptionState({ userId: "user-1", plan: "business", userStatus: "suspended" }).status).toBe("paused_user_suspended");
    expect(manualSubscriptionState({ userId: "user-1", plan: "free", userStatus: "active" }).status).toBe("inactive");
  });
});
