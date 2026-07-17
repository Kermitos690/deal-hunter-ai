import Link from "next/link";
import { requireUser } from "@/lib/security/session";
import { serviceDb } from "@/lib/db/server";
import { TelegramQuickPanel } from "@/components/telegram-quick-panel";
import { telegramStartUrl } from "@/lib/telegram-links";

export default async function DashboardPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin" && user.telegram_id === process.env.ADMIN_TELEGRAM_ID;
  const db = serviceDb();
  const [{ count: radars }, { count: alerts }, { data: deals }, { data: scans }, { data: activeRadars }] = await Promise.all([
    db.from("radars").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("is_active", true),
    db.from("alerts").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    db.from("deal_scores").select("estimated_net_profit,total_score,recommendation,products(title)").eq("user_id", user.id).order("total_score", { ascending: false }).limit(5),
    db.from("scan_logs").select("status,started_at,candidates_found,alerts_sent,radars(name)").eq("user_id", user.id).order("started_at", { ascending: false }).limit(5),
    db.from("radars").select("id,name,next_scan_at,last_scanned_at").eq("user_id", user.id).eq("is_active", true).order("next_scan_at", { ascending: true }).limit(3)
  ]);
  const profit = deals?.reduce((sum, deal) => sum + Number(deal.estimated_net_profit), 0) ?? 0;
  const nextStep = (radars ?? 0) === 0
    ? { title: "Crée ton premier radar", text: "Le plus simple : fais-le dans Telegram avec les boutons.", href: telegramStartUrl("newradar"), label: "Créer dans Telegram", external: true }
    : !deals?.length
      ? { title: "Lance un scan manuel", text: "Va dans Mes radars et clique Scanner pour obtenir un retour immédiat.", href: "/dashboard/radars", label: "Scanner un radar", external: false }
      : { title: "Analyse tes meilleures preuves", text: "Ouvre un deal pour voir comparables, calculs, offre max et checklist.", href: "/dashboard/deals", label: "Voir les deals", external: false };

  return <div>
    <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
      <section className="card border-mint/20">
        <div className="badge text-mint">Cockpit privé</div>
        <h1 className="mt-3 text-4xl font-black">Salut {user.display_name?.split(" ")[0] ?? "Hunter"} 👋</h1>
        <p className="mt-2 max-w-2xl text-slate-400">
          Ton dashboard explique ce que Telegram détecte : radars, scans, opportunités, preuves et résultats réels.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link className="button" href="/dashboard/radars/new">Créer sur le web</Link>
          <a className="button-secondary" href={telegramStartUrl("newradar")} target="_blank">Créer dans Telegram</a>
          <Link className="button-secondary" href="/dashboard/deals">Voir les opportunités</Link>
          {isAdmin && <Link className="button-secondary" href="/admin/system-health">Administration</Link>}
        </div>
      </section>
      <TelegramQuickPanel user={user} compact />
    </div>

    <div className="mt-8 grid gap-4 md:grid-cols-4">
      <Stat label="Radars actifs" value={radars ?? 0} />
      <Stat label="Alertes" value={alerts ?? 0} />
      <Stat label="Deals récents" value={deals?.length ?? 0} />
      <Stat label="Potentiel" value={`${profit.toFixed(0)} CHF`} />
    </div>

    <section className="card mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="badge text-cyan">Prochaine action</div>
          <h2 className="mt-2 text-xl font-black">{nextStep.title}</h2>
          <p className="mt-1 text-sm text-slate-400">{nextStep.text}</p>
        </div>
        {nextStep.external
          ? <a className="button" href={nextStep.href} target="_blank">{nextStep.label}</a>
          : <Link className="button" href={nextStep.href}>{nextStep.label}</Link>}
      </div>
    </section>

    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <section className="card">
        <div className="flex items-center justify-between gap-3"><h2 className="font-bold">Meilleures opportunités</h2><Link className="text-sm text-cyan" href="/dashboard/deals">Tout voir</Link></div>
        <div className="mt-4 space-y-3">{deals?.length ? deals.map((deal: any, index) => <div key={index} className="rounded-xl bg-black/20 p-3"><b>{deal.products?.title}</b><div className="text-sm text-slate-400">⭐ {deal.total_score} • {deal.recommendation} • +{deal.estimated_net_profit} CHF</div></div>) : <Empty title="Aucune opportunité encore" text="Crée un radar ou lance un scan manuel. Le résultat apparaîtra ici et dans Telegram." action="Créer dans Telegram" href={telegramStartUrl("newradar")} external />}</div>
      </section>
      <section className="card">
        <div className="flex items-center justify-between gap-3"><h2 className="font-bold">Derniers scans</h2><Link className="text-sm text-cyan" href="/dashboard/radars">Mes radars</Link></div>
        <div className="mt-4 space-y-3">{scans?.length ? scans.map((scan: any, index) => <div key={index} className="flex justify-between gap-3 rounded-xl bg-black/20 p-3 text-sm"><span>{scan.radars?.name ?? "Radar"}</span><span className="text-right text-slate-400">{scan.status} • {scan.candidates_found ?? 0} analysée(s) • {scan.alerts_sent} alerte(s)</span></div>) : <Empty title="Aucun scan lancé" text="Un scan démarre automatiquement après création Telegram. Tu peux aussi scanner manuellement." action="Voir mes radars" href="/dashboard/radars" />}</div>
      </section>
    </div>

    <section className="card mt-8">
      <h2 className="font-bold">Radars actifs maintenant</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {activeRadars?.length ? activeRadars.map((radar: any) => <Link href={`/dashboard/radars/${radar.id}`} className="rounded-xl bg-black/20 p-4 hover:bg-white/5" key={radar.id}><div className="font-bold">{radar.name}</div><div className="mt-1 text-xs text-slate-400">Prochain scan : {radar.next_scan_at ? new Date(radar.next_scan_at).toLocaleString("fr-CH") : "à planifier"}</div></Link>) : <p className="text-sm text-slate-400">Aucun radar actif.</p>}
      </div>
    </section>
  </div>;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="card"><div className="text-sm text-slate-400">{label}</div><div className="mt-2 text-3xl font-black">{value}</div></div>;
}

function Empty({ title, text, action, href, external }: { title: string; text: string; action: string; href: string; external?: boolean }) {
  return <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm"><div className="font-bold text-slate-100">{title}</div><p className="mt-1 text-slate-400">{text}</p>{external ? <a className="button-secondary mt-3 text-xs" href={href} target="_blank">{action}</a> : <Link className="button-secondary mt-3 text-xs" href={href}>{action}</Link>}</div>;
}
