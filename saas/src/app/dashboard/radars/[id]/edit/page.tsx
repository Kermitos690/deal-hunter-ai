import { notFound } from "next/navigation";
import { requireUser } from "@/lib/security/session";
import { serviceDb } from "@/lib/db/server";
import { RadarForm } from "@/components/radar-form";

export default async function EditRadarPage({params}:{params:Promise<{id:string}>}) {
  const user=await requireUser();
  const {data:radar}=await serviceDb().from("radars").select("*").eq("id",(await params).id).eq("user_id",user.id).maybeSingle();
  if(!radar) notFound();
  return <div className="mx-auto max-w-4xl"><h1 className="text-3xl font-black">Modifier le radar</h1><p className="mb-8 text-slate-400">Les changements s’appliqueront au prochain scan.</p><div className="card"><RadarForm initial={radar}/></div></div>;
}
