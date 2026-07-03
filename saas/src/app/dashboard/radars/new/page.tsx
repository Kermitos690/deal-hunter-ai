import { RadarForm } from "@/components/radar-form";
export default function NewRadarPage() {
  return <div className="mx-auto max-w-4xl"><h1 className="text-3xl font-black">Créer un radar</h1><p className="mb-8 text-slate-400">Tous les critères sont privés et liés à ton compte.</p><div className="card"><RadarForm /></div></div>;
}
