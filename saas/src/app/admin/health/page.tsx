import Link from "next/link";
import { requireAdmin } from "@/lib/security/session";
import { serviceDb } from "@/lib/db/server";
import { configuredSources, summarizeSourceLogs } from "@/lib/admin/source-health";
import { missingEnvironmentVariables } from "@/lib/env";

export default async function HealthPage() {
  await requireAdmin();
  const db=serviceDb();
  const week=new Date(Date.now()-7*86_400_000).toISOString();
  const [{data:lastScan},{data:logs}]=await Promise.all([
    db.from("scan_logs").select("*").order("started_at",{ascending:false}).limit(1).maybeSingle(),
    db.from("source_scan_logs").select("source,status,candidates_found,duration_ms,error_message,started_at,finished_at").gte("started_at",week).order("started_at",{ascending:false}).limit(1000)
  ]);
  const summaries=summarizeSourceLogs(logs??[]);
  const summaryBySource=new Map(summaries.map((item)=>[item.source,item]));
  const missing=missingEnvironmentVariables();
  return <main className="mx-auto max-w-6xl p-6 md:p-10"><Link href="/admin" className="text-slate-400">← Administration</Link><h1 className="mt-4 text-4xl font-black">Source Health</h1><p className="mt-2 text-slate-400">Configuration actuelle et mesures des sept derniers jours.</p>
    <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{configuredSources().map((config)=>{const health=summaryBySource.get(config.source);return <section className="card" key={config.source}><div className="flex items-center justify-between"><h2 className="font-black">{config.source}</h2><span className={`badge ${config.status==="active"?"text-mint":"text-amber-200"}`}>{config.status}</span></div><p className="mt-2 text-sm text-slate-400">{config.detail}</p><dl className="mt-5 grid grid-cols-2 gap-3 text-sm"><Metric k="Scans" v={health?.scans??0}/><Metric k="Erreurs" v={health?.errors??0}/><Metric k="Candidats" v={health?.candidates??0}/><Metric k="Durée moyenne" v={health?`${(health.averageDurationMs/1000).toFixed(1)} s`:"—"}/></dl><p className="mt-4 text-xs text-slate-500">Dernier succès : {health?.lastSuccessAt?new Date(health.lastSuccessAt).toLocaleString("fr-CH"):"aucun"}</p>{health?.lastError&&<p className="mt-2 rounded-lg bg-red-500/10 p-2 text-xs text-red-300">{health.lastError}</p>}</section>})}</div>
    <section className="card mt-6"><h2 className="font-bold">Système</h2><div className="mt-4 grid gap-3 md:grid-cols-3"><Metric k="Base de données" v="Connectée"/><Metric k="Dernier scan" v={lastScan?`${lastScan.status} — ${new Date(lastScan.started_at).toLocaleString("fr-CH")}`:"Aucun"}/><Metric k="Variables critiques" v={missing.length?`${missing.length} manquante(s)`:"OK"}/></div>{missing.length>0&&<p className="mt-4 text-sm text-red-300">{missing.join(", ")}</p>}<Link className="button-secondary mt-5 inline-flex" href="/admin/email-alerts">Configurer les alertes mail</Link></section>
  </main>;
}
function Metric({k,v}:{k:string;v:string|number}){return <div className="rounded-xl bg-black/20 p-3"><dt className="text-xs text-slate-500">{k}</dt><dd className="mt-1 font-bold">{v}</dd></div>}
