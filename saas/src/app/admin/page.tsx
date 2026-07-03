import Link from "next/link";
import { requireAdmin } from "@/lib/security/session";
import { serviceDb } from "@/lib/db/server";
import { AdminScanButton } from "@/components/admin-scan-button";
import { AdminUserActions } from "@/components/admin-user-actions";
export default async function AdminPage() {
  await requireAdmin();
  const db = serviceDb();
  const [{ count: users }, { count: radars }, { count: errors }, { data: userRows }] = await Promise.all([
    db.from("users").select("*",{count:"exact",head:true}),
    db.from("radars").select("*",{count:"exact",head:true}).eq("is_active",true),
    db.from("scan_logs").select("*",{count:"exact",head:true}).eq("status","error"),
    db.from("users")
      .select("id,telegram_id,email,display_name,role,plan,status,alerts_enabled,created_at,subscriptions(status,plan,current_period_end),radars(id,is_active)")
      .order("created_at", { ascending: false })
  ]);
  return <main className="mx-auto max-w-6xl p-6 md:p-10"><Link href="/dashboard" className="text-slate-400">← Dashboard</Link><div className="mt-4 flex flex-wrap items-center justify-between gap-4"><div><div className="badge text-mint">ADMIN PROTÉGÉ</div><h1 className="mt-3 text-4xl font-black">Administration</h1></div><AdminScanButton /></div>
  <div className="mt-8 grid gap-4 md:grid-cols-3"><Stat k="Utilisateurs" v={users??0}/><Stat k="Radars actifs" v={radars??0}/><Stat k="Erreurs scans" v={errors??0}/></div>
  <div className="mt-8 flex gap-3"><Link className="button-secondary" href="/admin/health">État du système</Link><a className="button-secondary" href="/api/admin/scan-logs">Logs JSON</a></div>
  <section className="mt-10">
    <h2 className="text-2xl font-black">Utilisateurs et abonnements</h2>
    <div className="mt-4 space-y-4">
      {(userRows ?? []).map((user: any) => {
        const subscription = Array.isArray(user.subscriptions)
          ? user.subscriptions[0]
          : user.subscriptions;
        const activeRadars = (user.radars ?? []).filter((radar: any) => radar.is_active).length;
        return <div className="card" key={user.id}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-bold">{user.display_name}</div>
              <div className="text-sm text-slate-400">
                Telegram {user.telegram_id ?? "—"} • {activeRadars} radar(s) actif(s)
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Facturation : {subscription?.status ?? "aucun abonnement"}
                {subscription?.current_period_end ? ` • jusqu’au ${new Date(subscription.current_period_end).toLocaleDateString("fr-CH")}` : ""}
              </div>
            </div>
            <AdminUserActions
              userId={user.id}
              initialPlan={user.plan}
              initialStatus={user.status}
              isPrimaryAdmin={user.telegram_id === process.env.ADMIN_TELEGRAM_ID}
            />
          </div>
        </div>;
      })}
    </div>
  </section></main>;
}
function Stat({k,v}:{k:string;v:number}) { return <div className="card"><div className="text-slate-400">{k}</div><div className="mt-2 text-4xl font-black">{v}</div></div>; }
