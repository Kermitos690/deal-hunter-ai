import Link from "next/link";
import { requireAdmin } from "@/lib/security/session";
import { serviceDb } from "@/lib/db/server";

const platforms = [
  {
    name: "eBay",
    priority: "Priorité 1",
    setup: "Créer des recherches sauvegardées par catégorie/marque et activer les notifications email.",
    examples: ["Nike Dunk -replica", "Omega Seamaster", "Louis Vuitton vintage"]
  },
  {
    name: "Ricardo",
    priority: "Priorité 1 Suisse",
    setup: "Créer des recherches sauvegardées et activer les emails dès nouvelle annonce si disponible.",
    examples: ["Nike Dunk", "Rolex", "Louis Vuitton"]
  },
  {
    name: "Anibis",
    priority: "Priorité 1 Suisse",
    setup: "Créer des alertes de recherche locales, budget large, email vers la boîte Deal Hunter.",
    examples: ["Sneakers Nike", "Montre Omega", "Sac Prada"]
  },
  {
    name: "Buyee / Yahoo Japan",
    priority: "Japon",
    setup: "Créer des watchlists ou recherches suivies quand le compte est disponible. Rediriger les emails vers Deal Hunter.",
    examples: ["Seiko vintage", "Porter Yoshida", "Japanese watch lot"]
  },
  {
    name: "KOMEHYO",
    priority: "Comparables / Japon",
    setup: "Utiliser les emails disponibles du compte et garder la source directe KOMEHYO active en parallèle.",
    examples: ["Omega", "Prada", "Louis Vuitton"]
  }
];

export default async function AdminEmailAlertsPage() {
  await requireAdmin();
  const [{ count: mailRadars }, { data: recentMailLogs }] = await Promise.all([
    serviceDb().from("radars").select("*", { count: "exact", head: true }).contains("sources", ["email-alerts"]),
    serviceDb().from("source_scan_logs").select("source,status,candidates_found,error_message,started_at").eq("source", "email-alerts").order("started_at", { ascending: false }).limit(8)
  ]);
  const ready = process.env.ENABLE_EMAIL_ALERTS_SOURCE === "true" &&
    Boolean(process.env.EMAIL_IMAP_SERVER && process.env.EMAIL_ADDRESS && process.env.EMAIL_APP_PASSWORD);
  return <main className="mx-auto max-w-6xl p-6 md:p-10">
    <Link href="/admin" className="text-slate-400">← Administration</Link>
    <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="badge text-mint">Fast lane email</div>
        <h1 className="mt-3 text-4xl font-black">Alertes mail marketplace</h1>
        <p className="mt-2 max-w-3xl text-slate-400">
          Les comptes marketplace restent à créer manuellement, mais Deal Hunter peut maintenant lire les emails toutes les 30 minutes via le scheduler.
        </p>
      </div>
      <span className={`badge ${ready ? "text-mint" : "text-amber-200"}`}>{ready ? "IMAP prêt" : "IMAP à configurer"}</span>
    </div>

    <section className="mt-8 grid gap-4 md:grid-cols-4">
      <Metric k="Source mail" v={ready ? "active" : "inactive"} />
      <Metric k="Radars mail" v={mailRadars ?? 0} />
      <Metric k="Mailbox" v={process.env.EMAIL_MAILBOX || "INBOX"} />
      <Metric k="Lookback" v={`${process.env.EMAIL_LOOKBACK_HOURS ?? 48} h`} />
    </section>

    <section className="card mt-6">
      <h2 className="text-xl font-bold">Checklist opérationnelle</h2>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-300">
        <li>Créer ou utiliser une boîte dédiée, par exemple <code>{process.env.EMAIL_ADDRESS || "dealhunter680@gmail.com"}</code>.</li>
        <li>Créer les comptes marketplace avec cette adresse ou rediriger leurs emails vers cette boîte.</li>
        <li>Créer des alertes/recherches sauvegardées larges sur chaque plateforme.</li>
        <li>Ajouter les domaines d’expéditeurs dans <code>EMAIL_ALLOWED_SENDERS</code> si tu veux filtrer strictement.</li>
        <li>Créer des radars qui incluent la source <code>email-alerts</code>.</li>
        <li>Surveiller cette page après les premiers emails reçus.</li>
      </ol>
    </section>

    <section className="mt-6 grid gap-4 lg:grid-cols-2">
      {platforms.map((platform) => <article className="card" key={platform.name}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-black">{platform.name}</h2>
          <span className="badge">{platform.priority}</span>
        </div>
        <p className="mt-3 text-sm text-slate-300">{platform.setup}</p>
        <div className="mt-4 text-xs uppercase tracking-wide text-slate-500">Exemples de recherches</div>
        <div className="mt-2 flex flex-wrap gap-2">{platform.examples.map((item) => <span className="badge" key={item}>{item}</span>)}</div>
      </article>)}
    </section>

    <section className="card mt-6">
      <h2 className="text-xl font-bold">Derniers scans email</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="text-slate-500"><tr><th className="pb-3">Date</th><th>Statut</th><th>Candidats</th><th>Erreur</th></tr></thead>
          <tbody>{(recentMailLogs ?? []).map((log: any, index: number) => <tr className="border-t border-white/10" key={index}>
            <td className="py-3">{new Date(log.started_at).toLocaleString("fr-CH")}</td>
            <td><span className="badge">{log.status}</span></td>
            <td>{log.candidates_found}</td>
            <td className="max-w-sm truncate text-red-300">{log.error_message ?? "—"}</td>
          </tr>)}</tbody>
        </table>
        {!recentMailLogs?.length && <p className="mt-4 text-sm text-slate-400">Aucun scan email enregistré pour l’instant.</p>}
      </div>
    </section>
  </main>;
}

function Metric({ k, v }: { k: string; v: string | number }) {
  return <div className="rounded-xl bg-black/20 p-4"><div className="text-xs text-slate-500">{k}</div><div className="mt-1 font-bold">{v}</div></div>;
}

