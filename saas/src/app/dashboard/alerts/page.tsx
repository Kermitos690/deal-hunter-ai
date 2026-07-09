import { requireUser } from "@/lib/security/session";
import { serviceDb } from "@/lib/db/server";
import { telegramStartUrl } from "@/lib/telegram-links";

const statusLabels: Record<string, string> = {
  sent: "Envoyée Telegram",
  created: "Créée",
  save: "Sauvegardée",
  saved: "Sauvegardée",
  reject: "Rejetée",
  rejected: "Rejetée",
  negotiate: "À négocier",
  telegram_token_missing: "Telegram non configuré",
  telegram_missing_user: "Utilisateur Telegram manquant",
  user_alerts_disabled: "Alertes utilisateur en pause",
  radar_alerts_disabled: "Alertes radar en pause"
};

export default async function AlertsPage() {
  const user = await requireUser();
  const { data } = await serviceDb().from("alerts").select("*, products(title,source), radars(name), deal_scores(total_score,recommendation,estimated_net_profit)").eq("user_id", user.id).order("created_at", { ascending: false });
  return <div>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="badge text-mint">Journal Telegram</div><h1 className="mt-3 text-3xl font-black">Historique des alertes</h1><p className="mt-1 text-slate-400">Tout ce qui est envoyé ou préparé pour tes radars apparaît ici.</p></div>
      <a className="button-secondary" href={telegramStartUrl("alerts")} target="_blank">Voir dans Telegram</a>
    </div>
    <div className="card mt-8 overflow-auto">
      {data?.length ? <table className="w-full min-w-[760px] text-left text-sm"><thead className="text-slate-500"><tr><th className="p-3">Produit</th><th>Radar</th><th>Source</th><th>Score</th><th>Profit</th><th>Statut</th><th>Date</th></tr></thead><tbody>{data.map((a:any) => <tr className="border-t border-white/10" key={a.id}><td className="p-3">{a.products?.title}</td><td>{a.radars?.name}</td><td>{a.products?.source}</td><td>{a.deal_scores?.total_score ?? "—"}</td><td>{a.deal_scores?.estimated_net_profit != null ? `${a.deal_scores.estimated_net_profit} CHF` : "—"}</td><td><span className="badge">{statusLabels[a.status] ?? a.status}</span></td><td>{new Date(a.created_at).toLocaleString("fr-CH")}</td></tr>)}</tbody></table> : <div className="py-10 text-center"><div className="text-4xl">🚨</div><h2 className="mt-3 text-2xl font-black">Aucune alerte encore</h2><p className="mt-2 text-slate-400">Crée un radar, lance un scan et les opportunités utiles arriveront ici et dans Telegram.</p><a className="button mt-5" href={telegramStartUrl("newradar")} target="_blank">Créer un radar</a></div>}
    </div>
  </div>;
}
