import { RadarForm } from "@/components/radar-form";
import Link from "next/link";
import { RADAR_TEMPLATES, radarTemplate } from "@/lib/radars/templates";
export default async function NewRadarPage({searchParams}:{searchParams:Promise<{template?:string}>}) {
  const template=radarTemplate((await searchParams).template);
  return <div className="mx-auto max-w-5xl"><h1 className="text-3xl font-black">Créer un radar</h1><p className="mb-6 text-slate-400">Choisis un point de départ ou configure librement. Le radar est actif immédiatement, sans validation admin.</p>
    <div className="mb-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{RADAR_TEMPLATES.map((item)=><Link key={item.id} href={`/dashboard/radars/new?template=${item.id}`} className={`rounded-2xl border p-4 ${template?.id===item.id?"border-mint bg-mint/10":"border-white/10 bg-white/[.03]"}`}><div className="font-bold">{item.title}</div><p className="mt-1 text-xs text-slate-400">{item.description}</p></Link>)}</div>
    <div className="card"><RadarForm template={template} /></div></div>;
}
