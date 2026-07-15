import Link from "next/link";
import { requireAdmin } from "@/lib/security/session";
import { serviceDb } from "@/lib/db/server";
import { AdminScanButton } from "@/components/admin-scan-button";
import { AdminUserActions } from "@/components/admin-user-actions";

export default async function AdminPage() {
  await requireAdmin();
  const db = serviceDb();
  const day = new Date(Date.now() - 86_400_000).toISOString();
  const week = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [
    { count: users }, { count: activeRadars }, { count: alertsToday },
    { count: scanErrors }, { count: soldComparables }, { count: activeUsers }, { count: suspendedUsers },
    { count: skippedScans }, { count: savedDeals }, { count: rejectedDeals }, { count: totalAlerts }, { data: userRows },
    { data: recentScans }, { data: recentAlerts }, { data: radars }, { data: realizedDeals }
  ] = await Promise.all([
    db.from("users").select("*",{count:"exact",head:true}),
    db.from("radars").select("*",{count:"exact",head:true}).eq("is_active",true),
    db.from("alerts").select("*",{count:"exact",head:true}).gte("created_at",day),
    db.from("scan_logs").select("*",{count:"exact",head:true}).eq("status","error").gte("started_at",week),
    db.from("market_comparables").select("*",{count:"exact",head:true}).eq("evidence_type","SOLD"),
    db.from("users").select("*",{count:"exact",head:true}).eq("status","active"),
    db.from("users").select("*",{count:"exact",head:true}).eq("status","suspended"),
    db.from("scan_logs").select("*",{count:"exact",head:true}).eq("status","skipped").gte("started_at",week),
    db.from("saved_deals").select("*",{count:"exact",head:true}),
    db.from("rejected_products").select("*",{count:"exact",head:true}),
    db.from("alerts").select("*",{count:"exact",head:true}),
    db.from("users").select("id,telegram_id,email,display_name,role,plan,status,alerts_enabled,created_at,subscriptions(provider,status,plan,current_period_end,cancel_at_period_end),radars(id,name,is_active,sources,last_scanned_at)").order("created_at",{ascending:false}),
    db.from("scan_logs").select("id,status,candidates_found,alerts_sent,error_message,started_at,finished_at,radars(name),users(display_name)").order("started_at",{ascending:false}).limit(12),
    db.from("alerts").select("id,status,created_at,users(display_name),products(title,source),deal_scores(total_score,estimated_net_profit,market_confidence)").order("created_at",{ascending:false}).limit(8),
    db.from("radars").select("id,name,is_active,sources,last_scanned_at,next_scan_at,users(display_name)").order("created_at",{ascending:false}),
    db.from("saved_deals").select("actual_profit,actual_buy_price").eq("lifecycle_status","sold")
  ]);
  const sourceCounts = (radars ?? []).flatMap((radar:any)=>radar.sources ?? []).reduce((acc:Record<string,number>,source:string)=>(acc[source]=(acc[source]??0)+1,acc),{});
  const realizedProfit=(realizedDeals??[]).reduce((sum:number,deal:any)=>sum+Number(deal.actual_profit??0),0);

  return <main className="mx-auto max-w-7xl p-6 md:p-10">
    <Link href="/dashboard" className="text-slate-400">← Dashboard utilisateur</Link>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4"><div><div className="badge text-mint">CENTRE DE CONTRÔLE</div><h1 className="mt-3 text-4xl font-black">Deal Hunter Admin</h1><p className="mt-2 text-slate-400">Utilisateurs, sources, scans, données marché et alertes.</p></div><AdminScanButton /></div>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Stat k="Utilisateurs" v={users??0} hint={`${activeUsers??0} actif(s), ${suspendedUsers??0} suspendu(s)`}/><Stat k="Radars actifs" v={activeRadars??0} hint="tous utilisateurs"/><Stat k="Alertes 24 h" v={alertsToday??0} hint="envoyées ou créées"/><Stat k="Erreurs 7 j" v={scanErrors??0} hint={`${skippedScans??0} scan(s) ignoré(s)`} danger={Boolean(scanErrors)}/><Stat k="Ventes vérifiées" v={soldComparables??0} hint="comparables marché"/>
    </div>
    <div className="mt-4 grid gap-4 sm:grid-cols-4"><Stat k="Deals sauvegardés" v={savedDeals??0} hint="actions utilisateurs"/><Stat k="Deals rejetés" v={rejectedDeals??0} hint="actions utilisateurs"/><Stat k="Taux actionnable" v={totalAlerts?Math.round(((savedDeals??0)/totalAlerts)*100):0} hint="% sauvegardés / alertes totales"/><Stat k="Bénéfice réel" v={Math.round(realizedProfit)} hint={`${realizedDeals?.length??0} revente(s), en CHF`}/></div>
    <nav className="mt-6 flex flex-wrap gap-3"><Link className="button-secondary" href="/admin/health">Santé et configuration</Link><Link className="button-secondary" href="/admin/email-alerts">Alertes mail</Link><Link className="button-secondary" href="/admin/communications">📣 Diffusion Telegram</Link><a className="button-secondary" href="/api/admin/scan-logs">Exporter les logs JSON</a></nav>

    <div className="mt-10 grid gap-6 xl:grid-cols-3">
      <section className="card xl:col-span-2"><Title title="Activité des scans" subtitle="12 dernières exécutions"/>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-slate-500"><tr><Th>Radar</Th><Th>Utilisateur</Th><Th>Résultat</Th><Th>Candidats</Th><Th>Alertes</Th><Th>Démarrage</Th></tr></thead><tbody>{(recentScans??[]).map((scan:any)=><tr className="border-t border-white/10" key={scan.id}><Td>{scan.radars?.name??"—"}</Td><Td>{scan.users?.display_name??"—"}</Td><Td><Status value={scan.status}/>{scan.error_message&&<div className="mt-1 max-w-xs truncate text-xs text-red-300" title={scan.error_message}>{scan.error_message}</div>}</Td><Td>{scan.candidates_found}</Td><Td>{scan.alerts_sent}</Td><Td>{new Date(scan.started_at).toLocaleString("fr-CH")}</Td></tr>)}</tbody></table></div>
      </section>
      <section className="card"><Title title="Sources utilisées" subtitle="Nombre de radars abonnés"/>
        <div className="mt-5 space-y-3">{Object.entries(sourceCounts as Record<string,number>).map(([source,count])=><div className="flex items-center justify-between rounded-xl bg-white/[.03] p-3" key={source}><div><div className="font-bold">{source}</div><div className="text-xs text-slate-500">{source==="ebay"?"API directe":source==="komehyo"?"Catalogue public Japon":source==="rss"?"Flux public":"IMAP sécurisé"}</div></div><span className="badge">{count} radar(s)</span></div>)}{!Object.keys(sourceCounts).length&&<p className="text-slate-400">Aucune source.</p>}</div>
      </section>
    </div>

    <section className="card mt-6"><Title title="Dernières opportunités" subtitle="Contrôle rapide du scoring et de la confiance marché"/>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-slate-500"><tr><Th>Produit</Th><Th>Utilisateur</Th><Th>Source</Th><Th>Score</Th><Th>Bénéfice</Th><Th>Confiance</Th><Th>État</Th></tr></thead><tbody>{(recentAlerts??[]).map((alert:any)=><tr className="border-t border-white/10" key={alert.id}><Td>{alert.products?.title??"—"}</Td><Td>{alert.users?.display_name??"—"}</Td><Td>{alert.products?.source??"—"}</Td><Td>{alert.deal_scores?.total_score??"—"}/100</Td><Td>{alert.deal_scores?.estimated_net_profit??"—"} CHF</Td><Td>{alert.deal_scores?.market_confidence??"LOW"}</Td><Td><Status value={alert.status}/></Td></tr>)}</tbody></table></div>
    </section>

    <section className="mt-10"><Title title="Utilisateurs et abonnements" subtitle="Plans, statut du compte, alertes et radars"/>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">{(userRows??[]).map((user:any)=>{
        const subscription=Array.isArray(user.subscriptions)?user.subscriptions[0]:user.subscriptions;
        const active=(user.radars??[]).filter((radar:any)=>radar.is_active).length;
        return <div className="card" key={user.id}><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><span className="font-bold">{user.display_name}</span>{user.role==="admin"&&<span className="badge text-mint">ADMIN</span>}</div><div className="mt-1 text-sm text-slate-400">{user.email??`Telegram ${user.telegram_id??"—"}`}</div><div className="mt-3 flex flex-wrap gap-2"><span className="badge">{active} radar(s)</span><span className="badge">{user.alerts_enabled?"Alertes actives":"Alertes coupées"}</span><span className="badge">Inscrit {new Date(user.created_at).toLocaleDateString("fr-CH")}</span></div><div className="mt-3 space-y-1">{(user.radars??[]).map((radar:any)=><div className="text-xs text-slate-400" key={radar.id}>{radar.is_active?"🟢":"⏸️"} {radar.name} • {(radar.sources??[]).join(", ")}</div>)}</div><div className="mt-2 text-xs text-slate-500">Facturation : {subscription?.provider??"—"} • {subscription?.plan??user.plan} • {subscription?.status??"aucun abonnement"}{subscription?.current_period_end?` • échéance ${new Date(subscription.current_period_end).toLocaleDateString("fr-CH")}`:""}{subscription?.cancel_at_period_end?" • annulation prévue":""}</div></div><AdminUserActions userId={user.id} initialPlan={user.plan} initialStatus={user.status} isPrimaryAdmin={user.telegram_id===process.env.ADMIN_TELEGRAM_ID}/></div></div>;
      })}</div>
    </section>
  </main>;
}
function Stat({k,v,hint,danger}:{k:string;v:number;hint:string;danger?:boolean}) { return <div className="card"><div className="text-sm text-slate-400">{k}</div><div className={`mt-2 text-4xl font-black ${danger?"text-red-300":""}`}>{v}</div><div className="mt-1 text-xs text-slate-500">{hint}</div></div>; }
function Title({title,subtitle}:{title:string;subtitle:string}) { return <div><h2 className="text-xl font-black">{title}</h2><p className="text-sm text-slate-500">{subtitle}</p></div>; }
function Th({children}:{children:React.ReactNode}) { return <th className="pb-3 pr-4 font-medium">{children}</th>; }
function Td({children}:{children:React.ReactNode}) { return <td className="py-3 pr-4">{children}</td>; }
function Status({value}:{value:string}) { const good=["success","sent","active"].includes(value); return <span className={`badge ${good?"text-mint":value==="error"?"text-red-300":"text-amber-200"}`}>{value}</span>; }
