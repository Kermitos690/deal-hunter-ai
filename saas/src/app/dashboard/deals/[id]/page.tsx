import { notFound } from "next/navigation";
import { requireUser } from "@/lib/security/session";
import { serviceDb } from "@/lib/db/server";
import { DealActions } from "@/components/deal-actions";
import { calculateResaleScenarios } from "@/scoring/resale-scenarios";
import { DealLifecycleForm } from "@/components/deal-lifecycle-form";
import { estimateAccuracy } from "@/lib/deals/lifecycle";
export default async function DealDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { data: deal } = await serviceDb().from("deal_scores").select("*, products(*, product_images(*)), radars(*), deal_score_comparables(*)").eq("id", (await params).id).eq("user_id", user.id).maybeSingle();
  if (!deal) notFound();
  const p = deal.products;
  const { data: savedDeal } = await serviceDb().from("saved_deals").select("*").eq("user_id", user.id).eq("product_id", p.id).maybeSingle();
  const radar = deal.radars;
  const scenarios = calculateResaleScenarios({
    itemPrice: Number(p.price_amount),
    shippingCost: Number(p.shipping_cost ?? radar.shipping_cost ?? 0),
    customsCost: Number(radar.customs_cost ?? 0),
    repairCost: Number(radar.repair_cost ?? 0),
    vatRate: Number(radar.vat_rate ?? 0),
    platformFeeRate: Number(radar.platform_fee_rate ?? 0),
    paymentFeeRate: Number(radar.payment_fee_rate ?? 0),
    marketLow: Number(deal.market_low ?? deal.estimated_resale_price),
    marketMedian: Number(deal.estimated_resale_price),
    marketHigh: Number(deal.market_high ?? deal.estimated_resale_price),
    targetProfit: Number(radar.min_profit ?? 0)
  });
  return <div><div className="flex flex-wrap justify-between gap-4"><div><span className="badge">{deal.recommendation}</span><h1 className="mt-3 text-3xl font-black">{p.title}</h1><p className="text-slate-400">{p.source} • {p.condition_grade}</p></div><DealActions id={deal.id} /></div>
    <div className="mt-8 grid gap-6 lg:grid-cols-2"><section className="card"><h2 className="font-bold">Photos</h2><div className="mt-4 grid grid-cols-2 gap-3">{p.product_images?.map((image:any) => <img key={image.id} className="aspect-square rounded-xl object-cover" src={image.image_url} alt={p.title} />)}</div></section>
    <section className="card"><h2 className="font-bold">Résumé exécutif</h2><div className="mt-5 grid grid-cols-2 gap-3"><Metric k="Achat livré" v={`${deal.estimated_buy_cost} CHF`} /><Metric k="Revente" v={`${deal.estimated_resale_price} CHF`} /><Metric k="Bénéfice net" v={`${deal.estimated_net_profit} CHF`} /><Metric k="ROI" v={`${deal.estimated_roi_percent}%`} /><Metric k="Score" v={`${deal.total_score}/100`} /><Metric k="Offre maximum" v={`${deal.maximum_offer ?? scenarios.maxItemPriceForTargetProfit} CHF`} /></div><a className="button mt-5" href={p.product_url} target="_blank">Ouvrir l’annonce</a></section></div>
    <section className="card mt-6 border border-mint/20"><div className="badge text-mint">PLAN D’ACTION</div><h2 className="mt-3 text-xl font-black">{deal.action_plan ?? `Ne pas dépasser ${scenarios.maxItemPriceForTargetProfit} CHF.`}</h2><div className="mt-4 grid gap-3 md:grid-cols-3"><Metric k="Canal conseillé" v={deal.recommended_channel ?? "eBay"} /><Metric k="Délai indicatif" v={`${deal.estimated_sale_days ?? "—"} jours`} /><Metric k="Seuil sans perte" v={`${deal.break_even_resale_price ?? scenarios.breakEvenResalePrice} CHF`} /></div></section>
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><section className="card"><h2 className="font-bold text-mint">Pourquoi</h2><ul className="mt-4 space-y-2">{deal.reasons.map((r:string) => <li key={r}>✓ {r}</li>)}</ul></section><section className="card"><h2 className="font-bold text-orange-200">Risques</h2><ul className="mt-4 space-y-2">{deal.warnings.map((w:string) => <li key={w}>⚠ {w}</li>)}</ul></section></div>
    <section className="card mt-6"><h2 className="font-bold">Scénarios de revente</h2><p className="mt-1 text-sm text-slate-400">Projection indicative après frais. Les prix ne sont jamais garantis.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">{scenarios.scenarios.map((scenario) => <div className="rounded-xl bg-black/20 p-4" key={scenario.key}><div className="text-sm font-bold">{scenario.label}</div><div className="mt-3 text-2xl font-black">{scenario.netProfit} CHF</div><div className="mt-1 text-sm text-slate-400">Revente {scenario.resalePrice} CHF • ROI {scenario.roiPercent}%</div><div className="mt-2 text-xs text-slate-500">Frais de vente : {scenario.saleFees} CHF</div></div>)}</div>
      <div className="mt-4 grid gap-3 md:grid-cols-2"><Metric k="Seuil de revente sans perte" v={`${scenarios.breakEvenResalePrice} CHF`} /><Metric k={`Prix d’achat max pour ${radar.min_profit ?? 0} CHF de bénéfice`} v={`${scenarios.maxItemPriceForTargetProfit} CHF`} /></div>
      <details className="mt-4 rounded-xl bg-black/20 p-4"><summary className="cursor-pointer font-bold">Voir le détail des coûts</summary><div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3"><Metric k="Prix annonce" v={`${scenarios.costs.itemPrice} CHF`} /><Metric k="Livraison" v={`${scenarios.costs.shippingCost} CHF`} /><Metric k="Douane" v={`${scenarios.costs.customsCost} CHF`} /><Metric k="Réparation" v={`${scenarios.costs.repairCost} CHF`} /><Metric k="TVA estimée" v={`${scenarios.costs.vat} CHF`} /><Metric k="Coût total d’achat" v={`${scenarios.costs.totalBuyCost} CHF`} /></div><p className="mt-3 text-xs text-slate-500">Commission totale appliquée à la revente : {scenarios.totalSaleFeeRate}%.</p></details>
    </section>
    <section className="card mt-6"><h2 className="font-bold">Comparables utilisés</h2><p className="mt-1 text-sm text-slate-400">{deal.comparable_count} comparable(s) • confiance {deal.market_confidence}</p>
      {deal.deal_score_comparables?.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-slate-500"><tr><th className="pb-3">Preuve</th><th>Source</th><th>Produit</th><th>Prix</th><th>Date</th><th>État</th><th>Fiabilité</th><th>Poids</th></tr></thead><tbody>{deal.deal_score_comparables.sort((a:any,b:any)=>b.weight-a.weight).map((c:any)=><tr className="border-t border-white/10" key={c.id}><td className="py-3"><span className="badge">{c.evidence_type}</span></td><td>{c.source}</td><td>{c.evidence_url?<a className="text-mint" href={c.evidence_url} target="_blank">{c.title??c.model??"Voir"}</a>:c.title??c.model??"—"}</td><td>{c.price} {c.currency}</td><td>{c.sold_at?new Date(c.sold_at).toLocaleDateString("fr-CH"):"—"}</td><td>{c.condition_grade??"—"}</td><td>{c.confidence}</td><td>{Number(c.weight).toFixed(3)}</td></tr>)}</tbody></table></div>:<div className="mt-4 rounded-xl bg-orange-400/10 p-4 text-orange-100">Aucun comparable solide enregistré. L’estimation est prudente et ne doit pas être considérée comme un prix de revente garanti.</div>}
    </section>
    <section className="card mt-6"><h2 className="font-bold">Checklist avant achat</h2><div className="mt-4 grid gap-2 md:grid-cols-2">{["Photos du numéro de série si disponible","Couture, logo et marquage","État intérieur","Port, douane et TVA","Politique de retour","Réputation vendeur","Ventes comparables","Ne pas dépasser le prix maximum"].map(x => <label key={x} className="flex gap-2"><input type="checkbox"/>{x}</label>)}</div></section>
    <section className="card mt-6"><h2 className="font-bold">Résultat réel</h2><p className="mt-1 text-sm text-slate-400">Ces données privées servent à mesurer et améliorer la fiabilité du scoring.</p>
      {savedDeal?.lifecycle_status === "sold" && savedDeal.actual_profit != null && (() => { const accuracy = estimateAccuracy(Number(deal.estimated_net_profit), Number(savedDeal.actual_profit)); return <div className="mt-4 grid gap-3 md:grid-cols-3"><Metric k="Bénéfice réel" v={`${savedDeal.actual_profit} CHF`} /><Metric k="Écart à l’estimation" v={`${accuracy.difference > 0 ? "+" : ""}${accuracy.difference} CHF`} /><Metric k="Erreur d’estimation" v={accuracy.errorPercent == null ? "—" : `${accuracy.errorPercent}%`} /></div>; })()}
      <DealLifecycleForm dealId={deal.id} saved={savedDeal} />
    </section>
  </div>;
}
function Metric({k,v}:{k:string;v:string}) { return <div className="rounded-xl bg-black/20 p-3"><div className="text-xs text-slate-500">{k}</div><div className="mt-1 text-lg font-bold">{v}</div></div>; }
