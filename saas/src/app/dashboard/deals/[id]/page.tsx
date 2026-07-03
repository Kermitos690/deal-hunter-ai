import { notFound } from "next/navigation";
import { requireUser } from "@/lib/security/session";
import { serviceDb } from "@/lib/db/server";
import { DealActions } from "@/components/deal-actions";
export default async function DealDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { data: deal } = await serviceDb().from("deal_scores").select("*, products(*, product_images(*)), radars(*)").eq("id", (await params).id).eq("user_id", user.id).maybeSingle();
  if (!deal) notFound();
  const p = deal.products;
  return <div><div className="flex flex-wrap justify-between gap-4"><div><span className="badge">{deal.recommendation}</span><h1 className="mt-3 text-3xl font-black">{p.title}</h1><p className="text-slate-400">{p.source} • {p.condition_grade}</p></div><DealActions id={deal.id} /></div>
    <div className="mt-8 grid gap-6 lg:grid-cols-2"><section className="card"><h2 className="font-bold">Photos</h2><div className="mt-4 grid grid-cols-2 gap-3">{p.product_images?.map((image:any) => <img key={image.id} className="aspect-square rounded-xl object-cover" src={image.image_url} alt={p.title} />)}</div></section>
    <section className="card"><h2 className="font-bold">Résumé exécutif</h2><div className="mt-5 grid grid-cols-2 gap-3"><Metric k="Achat livré" v={`${deal.estimated_buy_cost} CHF`} /><Metric k="Revente" v={`${deal.estimated_resale_price} CHF`} /><Metric k="Bénéfice net" v={`${deal.estimated_net_profit} CHF`} /><Metric k="ROI" v={`${deal.estimated_roi_percent}%`} /><Metric k="Score" v={`${deal.total_score}/100`} /><Metric k="Prix max conseillé" v={`${Math.max(0, deal.estimated_resale_price - deal.estimated_net_profit).toFixed(0)} CHF`} /></div><a className="button mt-5" href={p.product_url} target="_blank">Ouvrir l’annonce</a></section></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><section className="card"><h2 className="font-bold text-mint">Pourquoi</h2><ul className="mt-4 space-y-2">{deal.reasons.map((r:string) => <li key={r}>✓ {r}</li>)}</ul></section><section className="card"><h2 className="font-bold text-orange-200">Risques</h2><ul className="mt-4 space-y-2">{deal.warnings.map((w:string) => <li key={w}>⚠ {w}</li>)}</ul></section></div>
    <section className="card mt-6"><h2 className="font-bold">Checklist avant achat</h2><div className="mt-4 grid gap-2 md:grid-cols-2">{["Photos du numéro de série si disponible","Couture, logo et marquage","État intérieur","Port, douane et TVA","Politique de retour","Réputation vendeur","Ventes comparables","Ne pas dépasser le prix maximum"].map(x => <label key={x} className="flex gap-2"><input type="checkbox"/>{x}</label>)}</div></section>
  </div>;
}
function Metric({k,v}:{k:string;v:string}) { return <div className="rounded-xl bg-black/20 p-3"><div className="text-xs text-slate-500">{k}</div><div className="mt-1 text-lg font-bold">{v}</div></div>; }
