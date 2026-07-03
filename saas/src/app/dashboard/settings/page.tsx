import { requireUser } from "@/lib/security/session";
export default async function SettingsPage() {
  const user = await requireUser();
  return <div><h1 className="text-3xl font-black">Réglages</h1><div className="card mt-8 max-w-xl"><dl className="space-y-4"><Row k="Nom" v={user.display_name}/><Row k="Telegram ID" v={user.telegram_id ?? "—"}/><Row k="Plan" v={user.plan}/><Row k="Alertes" v={user.alerts_enabled ? "Actives" : "En pause"}/></dl><p className="mt-6 text-sm text-slate-400">Utilise /stop ou /resume dans Telegram pour modifier les alertes.</p></div></div>;
}
function Row({k,v}:{k:string;v:string}) { return <div className="flex justify-between"><dt className="text-slate-400">{k}</dt><dd>{v}</dd></div>; }
