import { requireUser } from "@/lib/security/session";
import { serviceDb } from "@/lib/db/server";

export default async function PerformancePage() {
  const user = await requireUser();
  const { data: rows } = await serviceDb().from("saved_deals")
    .select("*, products(title,source,deal_scores(estimated_net_profit,estimated_roi_percent))")
    .eq("user_id", user.id).order("created_at", { ascending: false });
  const deals = rows ?? [];
  const sold = deals.filter((row: any) => row.lifecycle_status === "sold" && row.actual_profit != null);
  const purchased = deals.filter((row: any) => ["purchased", "listed", "sold"].includes(row.lifecycle_status));
  const actualProfit = sold.reduce((sum: number, row: any) => sum + Number(row.actual_profit), 0);
  const invested = purchased.reduce((sum: number, row: any) => sum + Number(row.actual_buy_price ?? 0), 0);
  const estimated = sold.reduce((sum: number, row: any) => sum + Number(row.products?.deal_scores?.[0]?.estimated_net_profit ?? 0), 0);
  const accuracy = sold.length && estimated !== 0
    ? Math.max(0, 100 - Math.abs(actualProfit - estimated) / Math.abs(estimated) * 100) : null;
  const bySource = sold.reduce((map: Record<string, number>, row: any) => {
    const source = row.products?.source ?? "inconnue";
    map[source] = (map[source] ?? 0) + Number(row.actual_profit);
    return map;
  }, {});

  return <div><h1 className="text-3xl font-black">Performance réelle</h1><p className="text-slate-400">Tes opérations privées et l’écart entre prévision et résultat.</p>
    <div className="mt-8 grid gap-4 md:grid-cols-4"><Stat label="Deals achetés" value={purchased.length} /><Stat label="Deals revendus" value={sold.length} /><Stat label="Bénéfice réalisé" value={`${actualProfit.toFixed(0)} CHF`} /><Stat label="Précision du modèle" value={accuracy == null ? "À mesurer" : `${accuracy.toFixed(0)}%`} /></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><section className="card"><h2 className="font-bold">Capital et rendement</h2><div className="mt-4 grid grid-cols-2 gap-3"><Stat label="Capital engagé" value={`${invested.toFixed(0)} CHF`} /><Stat label="ROI réalisé" value={invested ? `${(actualProfit / invested * 100).toFixed(1)}%` : "—"} /></div></section>
      <section className="card"><h2 className="font-bold">Bénéfice par source</h2><div className="mt-4 space-y-2">{Object.entries(bySource).map(([source, profit]) => <div className="flex justify-between rounded-xl bg-black/20 p-3" key={source}><span>{source}</span><b className={profit >= 0 ? "text-mint" : "text-red-300"}>{profit.toFixed(0)} CHF</b></div>)}{!sold.length && <p className="text-slate-400">Les résultats apparaîtront après une première revente renseignée.</p>}</div></section></div>
    <section className="card mt-6"><h2 className="font-bold">Historique des décisions</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="text-slate-500"><tr><th className="pb-3">Produit</th><th>Source</th><th>Statut</th><th>Achat réel</th><th>Revente réelle</th><th>Bénéfice réel</th></tr></thead><tbody>{deals.map((row: any) => <tr className="border-t border-white/10" key={row.id}><td className="py-3">{row.products?.title}</td><td>{row.products?.source}</td><td>{row.lifecycle_status}</td><td>{row.actual_buy_price ?? "—"} CHF</td><td>{row.actual_sale_price ?? "—"} CHF</td><td>{row.actual_profit ?? "—"} CHF</td></tr>)}</tbody></table></div></section>
  </div>;
}
function Stat({label,value}:{label:string;value:string|number}) { return <div className="card"><div className="text-sm text-slate-400">{label}</div><div className="mt-2 text-2xl font-black">{value}</div></div>; }
