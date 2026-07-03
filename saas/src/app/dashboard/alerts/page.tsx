import { requireUser } from "@/lib/security/session";
import { serviceDb } from "@/lib/db/server";
export default async function AlertsPage() {
  const user = await requireUser();
  const { data } = await serviceDb().from("alerts").select("*, products(title,source), radars(name), deal_scores(total_score,recommendation)").eq("user_id", user.id).order("created_at", { ascending: false });
  return <div><h1 className="text-3xl font-black">Historique des alertes</h1><div className="card mt-8 overflow-auto"><table className="w-full text-left text-sm"><thead className="text-slate-500"><tr><th className="p-3">Produit</th><th>Radar</th><th>Score</th><th>Statut</th><th>Date</th></tr></thead><tbody>{data?.map((a:any) => <tr className="border-t border-white/10" key={a.id}><td className="p-3">{a.products?.title}</td><td>{a.radars?.name}</td><td>{a.deal_scores?.total_score}</td><td>{a.status}</td><td>{new Date(a.created_at).toLocaleString("fr-CH")}</td></tr>)}</tbody></table></div></div>;
}
