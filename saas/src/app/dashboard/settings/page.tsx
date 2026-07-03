import { requireUser } from "@/lib/security/session";
import { serviceDb } from "@/lib/db/server";
import { BillingActions } from "@/components/billing-actions";
export default async function SettingsPage() {
  const user = await requireUser();
  const billingConfigured = Boolean(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    process.env.STRIPE_PRO_PRICE_ID &&
    process.env.STRIPE_BUSINESS_PRICE_ID
  );
  const [{ data: subscription }, { data: payments }] = await Promise.all([
    serviceDb().from("subscriptions").select("*").eq("user_id", user.id).maybeSingle(),
    serviceDb().from("payments").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(10)
  ]);
  return <div><h1 className="text-3xl font-black">Réglages</h1><div className="card mt-8 max-w-xl"><dl className="space-y-4"><Row k="Nom" v={user.display_name}/><Row k="Telegram ID" v={user.telegram_id ?? "—"}/><Row k="Plan" v={user.plan}/><Row k="État abonnement" v={subscription?.status ?? "Aucun"}/><Row k="Alertes" v={user.alerts_enabled ? "Actives" : "En pause"}/></dl>{billingConfigured ? <BillingActions hasCustomer={Boolean(user.stripe_customer_id)}/> : <p className="mt-6 rounded-xl bg-orange-400/10 p-3 text-sm text-orange-200">Facturation en attente de la configuration Stripe.</p>}<p className="mt-6 text-sm text-slate-400">Utilise /stop ou /resume dans Telegram pour modifier les alertes.</p></div>
  <div className="card mt-6 max-w-xl"><h2 className="text-xl font-bold">Paiements</h2><div className="mt-4 space-y-3">{payments?.length ? payments.map((payment: any) => <div className="flex items-center justify-between gap-3 text-sm" key={payment.id}><span>{payment.status} • {(payment.amount_paid / 100).toFixed(2)} {payment.currency}</span>{payment.hosted_invoice_url && <a className="text-cyan" href={payment.hosted_invoice_url}>Facture</a>}</div>) : <p className="text-slate-400">Aucun paiement.</p>}</div></div></div>;
}
function Row({k,v}:{k:string;v:string}) { return <div className="flex justify-between"><dt className="text-slate-400">{k}</dt><dd>{v}</dd></div>; }
