import Stripe from "stripe";
import type { Plan } from "@/types";

export function stripeEnabled() {
  return process.env.ENABLE_STRIPE === "true";
}

export function stripeConfigured() {
  return Boolean(
    stripeEnabled() &&
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    process.env.STRIPE_PRO_PRICE_ID &&
    process.env.STRIPE_BUSINESS_PRICE_ID
  );
}

export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  return stripeEnabled() && key ? new Stripe(key, { typescript: true }) : null;
}

export function stripePriceForPlan(plan: Exclude<Plan, "free">) {
  return plan === "pro"
    ? process.env.STRIPE_PRO_PRICE_ID
    : process.env.STRIPE_BUSINESS_PRICE_ID;
}

export function planForStripePrice(priceId?: string | null): Plan {
  if (priceId && priceId === process.env.STRIPE_PRO_PRICE_ID) return "pro";
  if (priceId && priceId === process.env.STRIPE_BUSINESS_PRICE_ID) return "business";
  return "free";
}

export const paidSubscriptionStatuses = new Set(["active", "trialing"]);
