import { serviceDb } from "@/lib/db/server";
import { paidSubscriptionStatuses, stripeClient } from "@/lib/billing/stripe";
import {
  monthlyReferralCreditAmount,
  normalizeReferralCode,
  referralBotUrl,
  referralProgress
} from "./referral-program";

function dbFailure(operation: string, error: { message?: string } | null) {
  if (error) throw new Error(`${operation}: ${error.message ?? "database error"}`);
}

export async function claimReferralCode(userId: string, code: string) {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return { claimed: false, reason: "invalid_code" as const };
  const { data, error } = await serviceDb().rpc("claim_referral_code", {
    p_referred_user_id: userId,
    p_referral_code: normalized
  });
  if (error) {
    const message = error.message ?? "";
    if (message.includes("self_referral_forbidden")) return { claimed: false, reason: "self_referral" as const };
    if (message.includes("referral_already_claimed")) return { claimed: false, reason: "already_claimed" as const };
    if (message.includes("referral_claim_window_expired")) return { claimed: false, reason: "expired" as const };
    if (message.includes("subscription_already_started")) return { claimed: false, reason: "subscription_started" as const };
    if (message.includes("referral_code_invalid")) return { claimed: false, reason: "invalid_code" as const };
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { claimed: Boolean(row), reason: row ? null : "already_claimed", referral: row };
}

export async function qualifyReferralForPaidInvoice(userId: string, invoiceId: string) {
  const { data, error } = await serviceDb().rpc("qualify_paid_referral", {
    p_referred_user_id: userId,
    p_invoice_id: invoiceId
  });
  dbFailure("Qualification du parrainage", error);
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}

export async function referralSummary(userId: string) {
  const db = serviceDb();
  const [{ data: user, error: userError }, { data: referrals, error: referralsError }, { data: rewards, error: rewardsError }] = await Promise.all([
    db.from("users")
      .select("id,referral_code,referral_months_earned,referral_access_until")
      .eq("id", userId)
      .single(),
    db.from("referrals")
      .select("id,status,created_at,qualified_at,rewarded_at,referred_user_id")
      .eq("referrer_user_id", userId)
      .order("created_at", { ascending: false }),
    db.from("referral_rewards")
      .select("id,status,months,available_at,applied_at,stripe_credit_amount,stripe_credit_currency")
      .eq("user_id", userId)
      .order("available_at", { ascending: false })
  ]);
  dbFailure("Lecture du profil de parrainage", userError);
  dbFailure("Lecture des filleuls", referralsError);
  dbFailure("Lecture des récompenses", rewardsError);
  const code = String(user?.referral_code ?? "");
  const monthsEarned = Number(user?.referral_months_earned ?? 0);
  return {
    code,
    shareUrl: code ? referralBotUrl(code) : null,
    accessUntil: user?.referral_access_until ?? null,
    progress: referralProgress(monthsEarned),
    counts: {
      invited: (referrals ?? []).length,
      pending: (referrals ?? []).filter((row: any) => row.status === "pending").length,
      qualified: (referrals ?? []).filter((row: any) => ["qualified", "rewarded"].includes(row.status)).length,
      creditsAvailable: (rewards ?? []).filter((row: any) => row.status === "available").length,
      creditsApplied: (rewards ?? []).filter((row: any) => row.status === "applied").length
    },
    referrals: referrals ?? [],
    rewards: rewards ?? []
  };
}

export async function applyAvailableReferralCredits(userId: string) {
  const stripe = stripeClient();
  if (!stripe) return { applied: 0, skipped: "stripe_disabled" as const };
  const db = serviceDb();
  const [{ data: user, error: userError }, { data: subscription, error: subscriptionError }] = await Promise.all([
    db.from("users").select("id,stripe_customer_id").eq("id", userId).maybeSingle(),
    db.from("subscriptions")
      .select("price_id,status")
      .eq("user_id", userId)
      .maybeSingle()
  ]);
  dbFailure("Lecture client de parrainage", userError);
  dbFailure("Lecture abonnement de parrainage", subscriptionError);
  if (!user?.stripe_customer_id || !subscription?.price_id || !paidSubscriptionStatuses.has(subscription.status)) {
    return { applied: 0, skipped: "no_active_subscription" as const };
  }

  const price = await stripe.prices.retrieve(subscription.price_id);
  const amount = monthlyReferralCreditAmount({
    unitAmount: price.unit_amount,
    interval: price.recurring?.interval,
    intervalCount: price.recurring?.interval_count
  });
  if (!amount || !price.currency) return { applied: 0, skipped: "price_not_creditable" as const };

  const { data: rewards, error: rewardsError } = await db
    .from("referral_rewards")
    .select("id,months,status")
    .eq("user_id", userId)
    .eq("status", "available")
    .order("available_at", { ascending: true })
    .limit(24);
  dbFailure("Lecture des crédits de parrainage", rewardsError);

  let applied = 0;
  for (const reward of rewards ?? []) {
    const { data: claimed, error: claimError } = await db.rpc("claim_referral_reward_for_stripe", {
      p_reward_id: reward.id,
      p_user_id: userId
    });
    dbFailure("Réservation du crédit de parrainage", claimError);
    if (!claimed) continue;
    try {
      const totalAmount = amount * Math.max(1, Number(reward.months ?? 1));
      const transaction = await stripe.customers.createBalanceTransaction(
        user.stripe_customer_id,
        {
          amount: -totalAmount,
          currency: price.currency,
          description: "Deal Hunter AI — mois gratuit de parrainage",
          metadata: { referral_reward_id: reward.id, app_user_id: userId }
        },
        { idempotencyKey: `referral_reward_${reward.id}` }
      );
      const { error: updateError } = await db.from("referral_rewards").update({
        status: "applied",
        applied_at: new Date().toISOString(),
        stripe_credit_amount: totalAmount,
        stripe_credit_currency: price.currency.toUpperCase(),
        stripe_balance_transaction_id: transaction.id
      }).eq("id", reward.id).eq("user_id", userId).eq("status", "applying");
      dbFailure("Finalisation du crédit de parrainage", updateError);
      applied += 1;
    } catch (error) {
      const { error: releaseError } = await db.rpc("release_referral_reward_stripe_claim", {
        p_reward_id: reward.id,
        p_user_id: userId
      });
      if (releaseError) console.error("Referral credit claim release failed:", releaseError.message);
      console.error("Referral Stripe credit failed:", error instanceof Error ? error.message : "unknown");
    }
  }
  return { applied, skipped: null };
}
