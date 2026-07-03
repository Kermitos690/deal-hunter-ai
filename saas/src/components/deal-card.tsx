import Link from "next/link";
import { DealActions } from "./deal-actions";

export function DealCard({ deal }: { deal: any }) {
  const product = deal.products;
  const image = product?.product_images?.sort((a:any,b:any) => a.position-b.position)?.[0]?.image_url;
  return <article className="card overflow-hidden p-0"><div className="aspect-video bg-black/30">{image ? <img src={image} alt={product.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-600">Aucune photo</div>}</div>
    <div className="p-5"><div className="flex items-start justify-between gap-3"><div><span className="badge">{product.source}</span><h2 className="mt-2 text-lg font-bold">{product.title}</h2></div><span className={`rounded-xl px-3 py-2 text-lg font-black ${deal.total_score >= 85 ? "bg-green-400/15 text-mint" : "bg-orange-400/15 text-orange-200"}`}>{deal.total_score}</span></div>
    <div className="mt-4 grid grid-cols-3 gap-2 text-sm"><div><span className="text-slate-500">Prix</span><br/>{product.price_amount} CHF</div><div><span className="text-slate-500">Profit</span><br/><b className="text-mint">+{deal.estimated_net_profit} CHF</b></div><div><span className="text-slate-500">ROI</span><br/>{deal.estimated_roi_percent}%</div></div>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><Link className="button-secondary" href={`/dashboard/deals/${deal.id}`}>Analyse complète</Link><DealActions id={deal.id} /></div></div>
  </article>;
}
