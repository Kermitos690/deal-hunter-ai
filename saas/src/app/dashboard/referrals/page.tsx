import { ReferralShare } from "@/components/referral-share";
import { referralSummary } from "@/lib/referrals/server";
import { requireUser } from "@/lib/security/session";

export const dynamic = "force-dynamic";

function dateLabel(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium" }).format(new Date(value));
}

export default async function ReferralPage() {
  const user = await requireUser();
  if (process.env.ENABLE_REFERRALS !== "true") {
    return <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-black">Parrainage</h1>
      <div className="card mt-6">
        <div className="text-lg font-bold">Programme préparé, activation en cours</div>
        <p className="mt-2 text-slate-400">Les migrations et la configuration Stripe doivent être validées avant l’ouverture aux utilisateurs.</p>
      </div>
    </div>;
  }

  const summary = await referralSummary(user.id);
  const progress = summary.progress.monthsTowardNextYear;
  const percent = Math.round((progress / 12) * 100);

  return <div className="mx-auto max-w-5xl space-y-6">
    <div>
      <div className="text-sm font-bold uppercase tracking-[.18em] text-mint">Croissance communautaire</div>
      <h1 className="mt-2 text-3xl font-black">Parrainage Deal Hunter AI</h1>
      <p className="mt-2 max-w-3xl text-slate-400">Chaque personne invitée qui effectue son premier paiement réel te donne un mois gratuit. Douze filleuls payants correspondent à douze mois.</p>
    </div>

    <section className="card grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm text-slate-400">Ton code personnel</div>
          <div className="mt-1 text-2xl font-black text-mint">{summary.code}</div>
        </div>
        <div className="badge">{summary.progress.monthsEarned} mois gagné(s)</div>
      </div>
      {summary.shareUrl ? <ReferralShare url={summary.shareUrl} /> : null}
    </section>

    <section className="grid gap-4 md:grid-cols-4">
      <Metric label="Invités" value={summary.counts.invited} />
      <Metric label="En attente" value={summary.counts.pending} />
      <Metric label="Abonnés qualifiés" value={summary.counts.qualified} />
      <Metric label="Crédits appliqués" value={summary.counts.creditsApplied} />
    </section>

    <section className="card">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm text-slate-400">Progression vers la prochaine année gratuite</div>
          <div className="mt-1 text-2xl font-black">{progress}/12 mois</div>
        </div>
        <div className="text-sm text-slate-400">Accès récompense jusqu’au {dateLabel(summary.accessUntil)}</div>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-mint transition-all" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-3 text-sm text-slate-400">
        {summary.progress.fullYearsEarned > 0 ? `${summary.progress.fullYearsEarned} année(s) complète(s) déjà gagnée(s). ` : ""}
        Il reste {summary.progress.referralsUntilNextFreeYear} filleul(s) payé(s) pour compléter le prochain cycle de douze mois.
      </p>
    </section>

    <section className="card">
      <h2 className="text-xl font-black">Derniers parrainages</h2>
      <div className="mt-4 grid gap-3">
        {summary.referrals.length === 0 ? <p className="text-slate-400">Aucun filleul enregistré pour le moment.</p> : summary.referrals.slice(0, 20).map((referral: any) => <div key={referral.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3">
          <div>
            <div className="font-bold">Filleul enregistré</div>
            <div className="text-xs text-slate-500">Invitation du {dateLabel(referral.created_at)}</div>
          </div>
          <span className="badge">{referral.status === "pending" ? "En attente du premier paiement" : referral.status === "revoked" ? "Révoqué" : "Mois gagné"}</span>
        </div>)}
      </div>
    </section>

    <section className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5 text-sm text-amber-100">
      Un filleul ne peut être attribué qu’une seule fois. L’auto-parrainage, les comptes déjà abonnés et les inscriptions de plus de 30 jours sont refusés. Une facture gratuite ou à 0 CHF ne qualifie pas la récompense.
    </section>
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="card"><div className="text-sm text-slate-400">{label}</div><div className="mt-2 text-3xl font-black">{value}</div></div>;
}
