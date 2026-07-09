import { requireUser } from "@/lib/security/session";
import { serviceDb } from "@/lib/db/server";
import { BillingActions } from "@/components/billing-actions";
import { TelegramQuickPanel } from "@/components/telegram-quick-panel";

export default async function SettingsPage() {
  const user = await requireUser();
  const billingConfigured = Boolean(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    process.env.STRIPE_PRO_PRICE_ID &&
    process.env.STRIPE_BUSINESS_PRICE_ID
  );
  const [{ data: subscription }, { data: payments }, { data: channelUser }] = await Promise.all([
    serviceDb().from("subscriptions").select("*").eq("user_id", user.id).maybeSingle(),
    serviceDb().from("payments").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(10),
    serviceDb().from("users").select("whatsapp_phone,whatsapp_alerts_enabled,whatsapp_opt_in_at").eq("id", user.id).maybeSingle()
  ]);
  return <div>
    <div><div className="badge text-mint">Compte</div><h1 className="mt-3 text-3xl font-black">Réglages</h1><p className="mt-1 text-slate-400">Contrôle tes canaux, ton plan et tes alertes.</p></div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
      <section className="card"><h2 className="text-xl font-bold">Profil</h2><dl className="mt-5 space-y-4"><Row k="Nom" v={user.display_name}/><Row k="Telegram ID" v={user.telegram_id ?? "—"}/><Row k="Plan" v={user.plan}/><Row k="Compte" v={user.status}/><Row k="Alertes Telegram" v={user.alerts_enabled ? "Actives" : "En pause"}/><Row k="WhatsApp" v={channelUser?.whatsapp_phone ? `+${channelUser.whatsapp_phone}` : "Non configuré"}/><Row k="Alertes WhatsApp" v={channelUser?.whatsapp_alerts_enabled ? "Actives" : "Inactives"}/></dl></section>
      <TelegramQuickPanel user={user} />
    </div>
    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <section className="card"><h2 className="text-xl font-bold">Abonnement</h2><dl className="mt-5 space-y-4"><Row k="État abonnement" v={subscription?.status ?? "Aucun"}/><Row k="Plan facturé" v={subscription?.plan ?? user.plan}/></dl>{billingConfigured ? <BillingActions hasCustomer={Boolean(user.stripe_customer_id)}/> : <p className="mt-6 rounded-xl bg-orange-400/10 p-3 text-sm text-orange-200">Facturation Stripe préparée mais non activée. La bêta peut continuer sans paiement.</p>}</section>
      <section className="card"><h2 className="text-xl font-bold">Paiements</h2><div className="mt-4 space-y-3">{payments?.length ? payments.map((payment: any) => <div className="flex items-center justify-between gap-3 text-sm" key={payment.id}><span>{payment.status} • {(payment.amount_paid / 100).toFixed(2)} {payment.currency}</span>{payment.hosted_invoice_url && <a className="text-cyan" href={payment.hosted_invoice_url}>Facture</a>}</div>) : <p className="text-slate-400">Aucun paiement.</p>}</div></section>
    </div>
    <section className="card mt-6"><h2 className="font-bold">Commandes rapides</h2><p className="mt-1 text-sm text-slate-400">Depuis Telegram : <code>/stop</code> met les alertes en pause, <code>/resume</code> les réactive, <code>/whatsapp +41...</code> lie un numéro si WhatsApp Business est configuré.</p></section>
  </div>;
}

function Row({k,v}:{k:string;v:string}) { return <div className="flex justify-between gap-4"><dt className="text-slate-400">{k}</dt><dd className="text-right">{v}</dd></div>; }
