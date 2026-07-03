import Link from "next/link";
import { requireAdmin } from "@/lib/security/session";
import { serviceDb } from "@/lib/db/server";
import { AdminScanButton } from "@/components/admin-scan-button";
export default async function AdminPage() {
  await requireAdmin();
  const db = serviceDb();
  const [{ count: users }, { count: radars }, { count: errors }] = await Promise.all([
    db.from("users").select("*",{count:"exact",head:true}),
    db.from("radars").select("*",{count:"exact",head:true}).eq("is_active",true),
    db.from("scan_logs").select("*",{count:"exact",head:true}).eq("status","error")
  ]);
  return <main className="mx-auto max-w-6xl p-6 md:p-10"><Link href="/dashboard" className="text-slate-400">← Dashboard</Link><div className="mt-4 flex flex-wrap items-center justify-between gap-4"><div><div className="badge text-mint">ADMIN PROTÉGÉ</div><h1 className="mt-3 text-4xl font-black">Administration</h1></div><AdminScanButton /></div>
  <div className="mt-8 grid gap-4 md:grid-cols-3"><Stat k="Utilisateurs" v={users??0}/><Stat k="Radars actifs" v={radars??0}/><Stat k="Erreurs scans" v={errors??0}/></div>
  <div className="mt-8 flex gap-3"><Link className="button-secondary" href="/admin/health">État du système</Link><a className="button-secondary" href="/api/admin/scan-logs">Logs JSON</a></div></main>;
}
function Stat({k,v}:{k:string;v:number}) { return <div className="card"><div className="text-slate-400">{k}</div><div className="mt-2 text-4xl font-black">{v}</div></div>; }
