import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, jsonError } from "@/lib/api";
import { serviceDb } from "@/lib/db/server";
import { paidSubscriptionStatuses, stripeClient, stripePriceForPlan } from "@/lib/billing/stripe";
import { rateLimit } from "@/lib/security/rate-limit";

const schema = z.object({ plan: z.enum(["pro", "business"]) });

export async function POST(request: Request) {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  if (!await rateLimit(`billing-checkout:${auth.user.id}`, 5, 300)) {
    return jsonError("Trop de tentatives de paiement.", 429);
  }
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Plan invalide.", 422);
  const stripe = stripeClient();
  if (!stripe) return jsonError("Facturation Stripe non configurée.", 503);
  const price = stripePriceForPlan(parsed.data.plan);
  if (!price) return jsonError("Prix Stripe non configuré pour ce plan.", 503);

  const db = serviceDb();
  const { data: activeSubscription } = await db
    .from("subscriptions").select("status").eq("user_id", auth.user.id).maybeSingle();
  if (activeSubscription && paidSubscriptionStatuses.has(activeSubscription.status)) {
    return jsonError("Un abonnement actif existe déjà. Utilise le portail client.", 409);
  }

  let customerId = auth.user.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      ...(auth.user.email ? { email: auth.user.email } : {}),
      name: auth.user.display_name,
      metadata: { app_user_id: auth.user.id, telegram_id: auth.user.telegram_id ?? "" }
    });
    customerId = customer.id;
    await db.from("users").update({ stripe_customer_id: customerId }).eq("id", auth.user.id);
  }

  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${base}/dashboard/settings?billing=success`,
    cancel_url: `${base}/dashboard/settings?billing=cancelled`,
    client_reference_id: auth.user.id,
    metadata: { app_user_id: auth.user.id, plan: parsed.data.plan },
    subscription_data: {
      metadata: { app_user_id: auth.user.id, plan: parsed.data.plan }
    }
  });
  if (!session.url) return jsonError("Session Stripe sans URL.", 500);
  return NextResponse.json({ url: session.url });
}
