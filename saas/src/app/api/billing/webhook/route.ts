import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { serviceDb } from "@/lib/db/server";
import {
  paidSubscriptionStatuses,
  planForStripePrice,
  stripeClient
} from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

function databaseFailure(operation: string, error: { message?: string } | null) {
  if (error) throw new Error(`${operation}: ${error.message ?? "database error"}`);
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const db = serviceDb();
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
  const { data: user, error: userError } = await db
    .from("users").select("id").eq("stripe_customer_id", customerId).maybeSingle();
  databaseFailure("Lecture utilisateur Stripe", userError);
  if (!user) throw new Error("Utilisateur Stripe introuvable.");

  const priceId = subscription.items.data[0]?.price.id ?? null;
  const plan = planForStripePrice(priceId);
  const raw = subscription as Stripe.Subscription & { current_period_end?: number };
  const { error: subscriptionError } = await db.from("subscriptions").upsert({
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
  databaseFailure("Synchronisation abonnement Stripe", subscriptionError);

  const { error: planError } = await db.from("users").update({
    plan: paidSubscriptionStatuses.has(subscription.status) ? plan : "free"
  }).eq("id", user.id);
  databaseFailure("Synchronisation plan utilisateur", planError);
}

async function syncInvoice(invoice: Stripe.Invoice) {
  const db = serviceDb();
  const customerId = typeof invoice.customer === "string"
    ? invoice.customer
    : invoice.customer?.id;
  if (!customerId) return;
  const { data: user, error: userError } = await db
    .from("users").select("id").eq("stripe_customer_id", customerId).maybeSingle();
  databaseFailure("Lecture utilisateur facture Stripe", userError);
  if (!user) throw new Error("Utilisateur Stripe introuvable pour la facture.");
  const raw = invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null };
  const subscriptionId = typeof raw.subscription === "string"
    ? raw.subscription
    : raw.subscription?.id ?? null;
  const { error: paymentError } = await db.from("payments").upsert({
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
  databaseFailure("Synchronisation facture Stripe", paymentError);
}

async function processStripeEvent(event: Stripe.Event) {
  const db = serviceDb();
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    await syncSubscription(event.data.object as Stripe.Subscription);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.app_user_id ?? session.client_reference_id;
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
    if (userId && customerId) {
      const { error } = await db.from("users").update({ stripe_customer_id: customerId }).eq("id", userId);
      databaseFailure("Liaison client Stripe", error);
    }
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    await syncInvoice(event.data.object as Stripe.Invoice);
  }
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
  const { error: claimError } = await db.from("billing_events").insert({
    event_id: event.id,
    event_type: event.type
  });
  if (claimError?.code === "23505") {
    return NextResponse.json({ received: true, duplicate: true });
  }
  if (claimError) {
    console.error("Stripe event claim failed:", claimError.message);
    return NextResponse.json({ error: "Événement Stripe non enregistrable." }, { status: 500 });
  }

  try {
    await processStripeEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    // The row is a processing claim. Releasing it allows Stripe to retry after a
    // transient application or database failure without duplicating side effects.
    const { error: releaseError } = await db.from("billing_events").delete().eq("event_id", event.id);
    if (releaseError) console.error("Stripe event claim release failed:", releaseError.message);
    console.error("Stripe webhook processing failed:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Traitement Stripe impossible." }, { status: 500 });
  }
}
