import { notFound } from "next/navigation";
import { requireUser } from "@/lib/security/session";
import { serviceDb } from "@/lib/db/server";
import { RadarActions } from "@/components/radar-actions";

export default async function RadarDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { data: radar } = await serviceDb().from("radars").select("*, scan_logs(*), alerts(*,products(title))").eq("id", (await params).id).eq("user_id", user.id).maybeSingle();
  if (!radar) notFound();
  const logs = [...(radar.scan_logs ?? [])].sort((a: any,b: any) => b.started_at.localeCompare(a.started_at));
  return <div><div className="flex flex-wrap justify-between gap-4"><div><h1 className="text-3xl font-black">{radar.name}</h1><p className="text-slate-400">{radar.category} • {radar.sources.join(", ")}</p></div><RadarActions id={radar.id} active={radar.is_active} /></div>
    <div className="mt-8 grid gap-6 lg:grid-cols-3"><section className="card lg:col-span-1"><h2 className="font-bold">Critères</h2><dl className="mt-4 space-y-3 text-sm"><Row k="Budget" v={`${radar.max_buy_price} CHF`} /><Row k="Score min" v={radar.min_score} /><Row k="Marge min" v={`${radar.min_profit} CHF`} /><Row k="États" v={radar.accepted_conditions.join(", ")} /><Row k="Fréquence" v={`${radar.scan_frequency_minutes} min`} /></dl></section>
    <section className="card lg:col-span-2"><h2 className="font-bold">Historique des scans</h2><div className="mt-4 space-y-2">{logs.slice(0,20).map((log:any) => <div key={log.id} className="grid grid-cols-4 rounded-xl bg-black/20 p-3 text-sm"><span>{log.status}</span><span>{log.candidates_found} candidats</span><span>{log.alerts_sent} alertes</span><span>{new Date(log.started_at).toLocaleString("fr-CH")}</span></div>)}</div></section></div>
    <section className="card mt-6"><h2 className="font-bold">Alertes liées</h2><div className="mt-4 space-y-2">{radar.alerts?.map((alert:any) => <div key={alert.id} className="rounded-xl bg-black/20 p-3">{alert.products?.title} <span className="text-slate-400">• {alert.status}</span></div>)}</div></section>
  </div>;
}
function Row({k,v}:{k:string;v:any}) { return <div className="flex justify-between gap-4"><dt className="text-slate-400">{k}</dt><dd className="text-right">{String(v)}</dd></div>; }
