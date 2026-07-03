import Link from "next/link";
import { requireUser } from "@/lib/security/session";
import { serviceDb } from "@/lib/db/server";

export default async function DashboardPage() {
  const user = await requireUser();
  const db = serviceDb();
  const [{ count: radars }, { count: alerts }, { data: deals }, { data: scans }] = await Promise.all([
    db.from("radars").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("is_active", true),
    db.from("alerts").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    db.from("deal_scores").select("estimated_net_profit,total_score,recommendation,products(title)").eq("user_id", user.id).order("total_score", { ascending: false }).limit(5),
    db.from("scan_logs").select("status,started_at,candidates_found,alerts_sent,radars(name)").eq("user_id", user.id).order("started_at", { ascending: false }).limit(5)
  ]);
  const profit = deals?.reduce((sum, deal) => sum + Number(deal.estimated_net_profit), 0) ?? 0;
  return <div>
    <div className="flex items-center justify-between"><div><h1 className="text-3xl font-black">Vue générale</h1><p className="text-slate-400">Tes données uniquement, isolées par compte.</p></div><Link className="button" href="/dashboard/radars/new">+ Radar</Link></div>
    <div className="mt-8 grid gap-4 md:grid-cols-4">
      <Stat label="Radars actifs" value={radars ?? 0} />
      <Stat label="Alertes" value={alerts ?? 0} />
      <Stat label="Deals récents" value={deals?.length ?? 0} />
      <Stat label="Potentiel" value={`${profit.toFixed(0)} CHF`} />
    </div>
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <section className="card"><h2 className="font-bold">Meilleures opportunités</h2><div className="mt-4 space-y-3">{deals?.map((deal: any, index) => <div key={index} className="rounded-xl bg-black/20 p-3"><b>{deal.products?.title}</b><div className="text-sm text-slate-400">⭐ {deal.total_score} • {deal.recommendation} • +{deal.estimated_net_profit} CHF</div></div>) || "Aucun deal."}</div></section>
      <section className="card"><h2 className="font-bold">Derniers scans</h2><div className="mt-4 space-y-3">{scans?.map((scan: any, index) => <div key={index} className="flex justify-between rounded-xl bg-black/20 p-3 text-sm"><span>{scan.radars?.name}</span><span className="text-slate-400">{scan.status} • {scan.alerts_sent} alerte(s)</span></div>) || "Aucun scan."}</div></section>
    </div>
  </div>;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="card"><div className="text-sm text-slate-400">{label}</div><div className="mt-2 text-3xl font-black">{value}</div></div>;
}
