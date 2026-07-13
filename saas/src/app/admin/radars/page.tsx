import Link from "next/link";
import { AdminRadarScanButton } from "@/components/admin-radar-scan-button";
import { serviceDb } from "@/lib/db/server";
import { requireAdmin } from "@/lib/security/session";

export const dynamic = "force-dynamic";

export default async function AdminRadarsPage() {
  await requireAdmin();
  const { data: radars, error } = await serviceDb()
    .from("radars")
    .select("id,name,is_active,sources,last_scanned_at,next_scan_at,scan_frequency_minutes,users(display_name,status)")
    .order("created_at", { ascending: false })
    .limit(200);

  return <main className="mx-auto max-w-6xl p-6 md:p-10">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <Link href="/admin" className="text-slate-400">← Administration</Link>
        <h1 className="mt-4 text-4xl font-black">Radars administrateur</h1>
        <p className="mt-2 text-slate-400">Lance un radar précis avec le moteur, le verrou et les logs de production.</p>
      </div>
      <Link className="button-secondary" href="/admin/system-health">System Health</Link>
    </div>

    {error && <p className="card mt-6 text-red-300">Impossible de charger les radars : {error.message}</p>}
    <div className="mt-8 space-y-4">
      {(radars ?? []).map((radar: any) => <section className="card" key={radar.id}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold">{radar.name}</h2>
              <span className="badge">{radar.is_active ? "active" : "paused"}</span>
              <span className="badge">{radar.users?.status ?? "unknown user"}</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">{radar.users?.display_name ?? "Utilisateur inconnu"}</p>
            <p className="mt-2 text-xs text-slate-500">Sources : {(radar.sources ?? []).join(", ") || "aucune"}</p>
            <p className="mt-1 text-xs text-slate-500">Dernier scan : {radar.last_scanned_at ? new Date(radar.last_scanned_at).toLocaleString("fr-CH") : "jamais"} · prochain : {radar.next_scan_at ? new Date(radar.next_scan_at).toLocaleString("fr-CH") : "non planifié"}</p>
          </div>
          {radar.is_active ? <AdminRadarScanButton radarId={radar.id}/> : <span className="text-sm text-orange-200">Réactive le radar avant de le scanner.</span>}
        </div>
      </section>)}
      {!radars?.length && !error && <p className="card text-slate-400">Aucun radar.</p>}
    </div>
  </main>;
}
