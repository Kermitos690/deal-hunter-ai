import Link from "next/link";
import { requireAdmin } from "@/lib/security/session";
import { serviceDb } from "@/lib/db/server";
import { missingEnvironmentVariables } from "@/lib/env";
export default async function HealthPage() {
  await requireAdmin();
  const { data: lastScan } = await serviceDb().from("scan_logs").select("*").order("started_at",{ascending:false}).limit(1).maybeSingle();
  const checks = [
    ["Base de données","Connectée",true],
    ["Bot Telegram",process.env.TELEGRAM_BOT_TOKEN?"Configuré":"Manquant",Boolean(process.env.TELEGRAM_BOT_TOKEN)],
    ["Cron",process.env.CRON_SECRET?"Configuré":"Manquant",Boolean(process.env.CRON_SECRET)],
    ["Stripe",process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_WEBHOOK_SECRET?"Configuré":"À configurer",Boolean(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_WEBHOOK_SECRET)],
    ["Dernier scan",lastScan ? `${lastScan.status} — ${new Date(lastScan.started_at).toLocaleString("fr-CH")}`:"Aucun",Boolean(lastScan)]
  ];
  const missing=missingEnvironmentVariables();
  return <main className="mx-auto max-w-4xl p-6 md:p-10"><Link href="/admin" className="text-slate-400">← Administration</Link><h1 className="mt-4 text-4xl font-black">Santé du système</h1><div className="mt-8 grid gap-4">{checks.map(([k,v,ok])=><div className="card flex justify-between" key={String(k)}><span>{String(k)}</span><span className={ok?"text-mint":"text-red-300"}>{String(v)}</span></div>)}</div><div className="card mt-6"><h2 className="font-bold">Variables manquantes</h2><p className="mt-2 text-slate-400">{missing.length?missing.join(", "):"Aucune variable critique manquante."}</p></div></main>;
}
