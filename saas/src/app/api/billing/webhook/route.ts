import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { serviceDb } from "@/lib/db/server";
import {
  paidSubscriptionStatuses,
  planForStripePrice,
  stripeClient
} from "@/lib/billing/stripe";

async function syncSubscription(subscription: Stripe.Subscription) {
  const db = serviceDb();
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
  const { data: user } = await db
    .from("users").select("id").eq("stripe_customer_id", customerId).maybeSingle();
  if (!user) throw new Error(`Utilisateur Stripe introuvable pour ${customerId}`);

  const priceId = subscription.items.data[0]?.price.id ?? null;
  const plan = planForStripePrice(priceId);
  const raw = subscription as Stripe.Subscription & { current_period_end?: number };
  await db.from("subscriptions").upsert({
    user_id: user.id,
    customer_id: customerId,
    subscription_id: subscription.id,
    price_id: priceId,
    plan,
    status: subscription.status,
    current_period_end: raw.current_period_end
      ? new Date(raw.current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: subscription.cancel_at_period_end
  }, { onConflict: "user_id" });

  await db.from("users").update({
    plan: paidSubscriptionStatuses.has(subscription.status) ? plan : "free"
  }).eq("id", user.id);
}

async function syncInvoice(invoice: Stripe.Invoice) {
  const db = serviceDb();
  const customerId = typeof invoice.customer === "string"
    ? invoice.customer
    : invoice.customer?.id;
  if (!customerId) return;
  const { data: user } = await db
    .from("users").select("id").eq("stripe_customer_id", customerId).maybeSingle();
  if (!user) throw new Error(`Utilisateur Stripe introuvable pour ${customerId}`);
  const raw = invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null };
  const subscriptionId = typeof raw.subscription === "string"
    ? raw.subscription
    : raw.subscription?.id ?? null;
  await db.from("payments").upsert({
    user_id: user.id,
    invoice_id: invoice.id,
    customer_id: customerId,
    subscription_id: subscriptionId,
    amount_due: invoice.amount_due,
    amount_paid: invoice.amount_paid,
    currency: invoice.currency.toUpperCase(),
    status: invoice.status ?? "unknown",
    hosted_invoice_url: invoice.hosted_invoice_url,
    invoice_pdf: invoice.invoice_pdf,
    paid_at: invoice.status_transitions.paid_at
      ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
      : null
  }, { onConflict: "invoice_id" });
}

export async function POST(request: Request) {
  const stripe = stripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe non configuré." }, { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Signature manquante." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Signature Stripe invalide." }, { status: 400 });
  }

  const db = serviceDb();
  const { data: processed } = await db
    .from("billing_events").select("event_id").eq("event_id", event.id).maybeSingle();
  if (processed) return NextResponse.json({ received: true, duplicate: true });

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) await syncSubscription(event.data.object as Stripe.Subscription);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.app_user_id ?? session.client_reference_id;
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
    if (userId && customerId) {
      await db.from("users").update({ stripe_customer_id: customerId }).eq("id", userId);
    }
  }
  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    await syncInvoice(event.data.object as Stripe.Invoice);
  }

  await db.from("billing_events").insert({ event_id: event.id, event_type: event.type });
  return NextResponse.json({ received: true });
}
