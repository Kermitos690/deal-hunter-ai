import { requireUser } from "@/lib/security/session";
import { serviceDb } from "@/lib/db/server";
import { DealCard } from "@/components/deal-card";
export default async function DealsPage() {
  const user = await requireUser();
  const { data } = await serviceDb().from("deal_scores").select("*, products(*, product_images(*)), radars(name)").eq("user_id", user.id).order("total_score", { ascending: false });
  return <div><h1 className="text-3xl font-black">Mes opportunités</h1><p className="text-slate-400">Scores et données propres à tes radars.</p><div className="mt-8 grid gap-5 xl:grid-cols-2">{data?.map((deal:any) => <DealCard key={deal.id} deal={deal} />)}</div>{!data?.length && <div className="card mt-8 text-slate-400">Lance un radar mock pour générer les premiers deals.</div>}</div>;
}
