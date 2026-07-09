import Link from "next/link";
import { DealActions } from "./deal-actions";

export function DealCard({ deal }: { deal: any }) {
  const product = deal.products;
  const statusLabels:Record<string,string>={APPROVED:"VALIDÉ",CONDITIONAL:"SOUS CONDITIONS",REVIEW_REQUIRED:"REVUE REQUISE",REJECTED:"ÉCARTÉ"};
  const proofLabels:Record<string,string>={
    A:"preuve forte",
    B:"preuve correcte",
    C:"preuve limitée",
    D:"preuve faible"
  };
  const image = product?.product_images?.sort((a:any,b:any) => a.position-b.position)?.[0]?.image_url;
  return <article className="card overflow-hidden p-0"><div className="aspect-video bg-black/30">{image ? <img src={image} alt={product.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-600">Aucune photo</div>}</div>
    <div className="p-5"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><span className="badge">{product.source}</span><span className="badge">{statusLabels[deal.decision_status]??"REVUE REQUISE"}</span><span className="badge">{proofLabels[deal.evidence_grade]??"preuve faible"} • {deal.comparable_count??0} comp.</span></div><h2 className="mt-2 text-lg font-bold">{product.title}</h2></div><span className={`rounded-xl px-3 py-2 text-lg font-black ${deal.total_score >= 85 ? "bg-green-400/15 text-mint" : deal.total_score >= 70 ? "bg-blue-400/15 text-blue-100" : "bg-orange-400/15 text-orange-200"}`}>{deal.total_score}</span></div>
    <div className="mt-4 grid grid-cols-3 gap-2 text-sm"><div><span className="text-slate-500">Prix</span><br/>{product.price_amount} CHF</div><div><span className="text-slate-500">Profit</span><br/><b className={Number(deal.estimated_net_profit)>=0?"text-mint":"text-red-200"}>{Number(deal.estimated_net_profit)>=0?"+":""}{deal.estimated_net_profit} CHF</b></div><div><span className="text-slate-500">ROI</span><br/>{deal.estimated_roi_percent}%</div></div>
    <div className="mt-4 rounded-xl bg-black/20 p-3 text-xs text-slate-400">Offre max : <b className="text-slate-200">{deal.maximum_offer ?? "—"} CHF</b> • Confiance : <b className="text-slate-200">{deal.market_confidence ?? "LOW"}</b> • Moteur : {deal.scoring_version ?? "—"}</div>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><Link className="button-secondary" href={`/dashboard/deals/${deal.id}`}>Analyse complète</Link><DealActions id={deal.id} /></div></div>
  </article>;
}
