import Link from "next/link";
import { requireUser } from "@/lib/security/session";
import { serviceDb } from "@/lib/db/server";
import { RadarActions } from "@/components/radar-actions";

export default async function RadarsPage() {
  const user = await requireUser();
  const { data } = await serviceDb().from("radars").select("*, alerts(count)").eq("user_id", user.id).order("created_at", { ascending: false });
  return <div>
    <div className="flex justify-between"><div><h1 className="text-3xl font-black">Mes radars</h1><p className="text-slate-400">Personne d’autre ne peut les voir.</p></div><Link className="button" href="/dashboard/radars/new">Créer</Link></div>
    <div className="mt-8 grid gap-4">{data?.map((radar: any) => <article className="card" key={radar.id}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><Link href={`/dashboard/radars/${radar.id}`} className="text-xl font-bold hover:text-mint">{radar.name}</Link><div className="mt-2 flex gap-2"><span className="badge">{radar.is_active ? "Actif" : "Pause"}</span><span className="badge">{radar.sources.join(", ")}</span><span className="badge">score ≥ {radar.min_score}</span></div></div><RadarActions id={radar.id} active={radar.is_active} /></div>
      <div className="mt-4 grid gap-2 text-sm text-slate-400 md:grid-cols-4"><span>Budget {radar.max_buy_price} CHF</span><span>Marge ≥ {radar.min_profit} CHF</span><span>Scan {radar.scan_frequency_minutes} min</span><span>Dernier : {radar.last_scanned_at ? new Date(radar.last_scanned_at).toLocaleString("fr-CH") : "jamais"}</span></div>
    </article>)}</div>
  </div>;
}
