import Link from "next/link";
import { requireUser } from "@/lib/security/session";
import { serviceDb } from "@/lib/db/server";
import { RadarActions } from "@/components/radar-actions";
import { PLAN_LIMITS } from "@/plans/limits";
import { telegramStartUrl } from "@/lib/telegram-links";

export default async function RadarsPage() {
  const user = await requireUser();
  const limits = PLAN_LIMITS[user.plan];
  const { data } = await serviceDb().from("radars").select("*, alerts(count)").eq("user_id", user.id).order("created_at", { ascending: false });
  const activeCount = (data ?? []).filter((r: any) => r.is_active).length;
  return <div>
    <div className="grid gap-6 xl:grid-cols-[1fr_.75fr]">
      <section>
        <div className="badge text-mint">Radars privés</div>
        <h1 className="mt-3 text-3xl font-black">Mes radars</h1>
        <p className="mt-2 text-slate-400">
          Plan {user.plan} • {activeCount}/{limits.activeRadars===Number.MAX_SAFE_INTEGER?"∞":limits.activeRadars} actifs • scan minimum {limits.minScanMinutes} min.
        </p>
      </section>
      <section className="card">
        <h2 className="font-bold">Le plus simple : Telegram</h2>
        <p className="mt-1 text-sm text-slate-400">Pour un bêta-testeur, le tunnel Telegram est le chemin recommandé : boutons, scan immédiat, résultat envoyé.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a className="button" href={telegramStartUrl("newradar")} target="_blank">Créer dans Telegram</a>
          <Link className="button-secondary" href="/dashboard/radars/new">Créer sur le web</Link>
        </div>
      </section>
    </div>

    <div className="mt-8 grid gap-4">{data?.length ? data.map((radar: any) => <article className="card" key={radar.id}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/dashboard/radars/${radar.id}`} className="text-xl font-bold hover:text-mint">{radar.name}</Link>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="badge">{radar.is_active ? "Actif" : "Pause"}</span>
            <span className="badge">{radar.sources.join(", ")}</span>
            <span className="badge">score ≥ {radar.min_score}</span>
            <span className="badge">ROI ≥ {radar.min_roi_percent}%</span>
          </div>
        </div>
        <RadarActions id={radar.id} active={radar.is_active} />
      </div>
      <div className="mt-4 grid gap-2 text-sm text-slate-400 md:grid-cols-5">
        <span>Budget {radar.max_buy_price} CHF</span>
        <span>Marge ≥ {radar.min_profit} CHF</span>
        <span>Scan {radar.scan_frequency_minutes} min</span>
        <span>Dernier : {radar.last_scanned_at ? new Date(radar.last_scanned_at).toLocaleString("fr-CH") : "jamais"}</span>
        <span>Prochain : {radar.next_scan_at ? new Date(radar.next_scan_at).toLocaleString("fr-CH") : "—"}</span>
      </div>
    </article>) : <section className="card text-center">
      <div className="mx-auto max-w-lg">
        <div className="text-4xl">📡</div>
        <h2 className="mt-3 text-2xl font-black">Aucun radar pour l’instant</h2>
        <p className="mt-2 text-slate-400">Crée ton premier radar depuis Telegram : il sera actif immédiatement et le premier scan démarre automatiquement.</p>
        <a className="button mt-5" href={telegramStartUrl("newradar")} target="_blank">Créer mon premier radar</a>
      </div>
    </section>}</div>
  </div>;
}
