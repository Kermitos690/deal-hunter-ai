import { NextResponse } from "next/server";
import { apiUser, jsonError } from "@/lib/api";
import { stripeClient } from "@/lib/billing/stripe";

export async function POST() {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  const stripe = stripeClient();
  if (!stripe) return jsonError("Facturation Stripe non configurée.", 503);
  if (!auth.user.stripe_customer_id) return jsonError("Aucun compte de facturation.", 404);
  const session = await stripe.billingPortal.sessions.create({
    customer: auth.user.stripe_customer_id,
    return_url: `${process.env.APP_BASE_URL}/dashboard/settings`
  });
  return NextResponse.json({ url: session.url });
}
