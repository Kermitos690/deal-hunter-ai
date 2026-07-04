import Link from "next/link";

export default function Landing() {
  return (
    <main>
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-xl font-black">DEAL HUNTER <span className="text-mint">AI</span></span>
        <div className="flex gap-2"><Link className="button-secondary" href="/partenaires">Partenaires</Link><Link className="button-secondary" href="/methodologie">Méthodologie</Link><Link className="button-secondary" href="/login">Connexion</Link></div>
      </nav>
      <section className="mx-auto grid min-h-[70vh] max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2">
        <div>
          <div className="badge mb-5 text-cyan">Radars privés • Alertes Telegram • Scoring réaliste</div>
          <h1 className="text-5xl font-black leading-tight md:text-7xl">Les bonnes annonces, avant le bruit.</h1>
          <p className="mt-6 max-w-xl text-lg text-slate-300">
            Crée tes radars spécialisés. Deal Hunter documente la marge, le niveau de preuve,
            les risques et le prix plafond avant de produire une décision traçable.
          </p>
          <div className="mt-8 flex gap-3">
            <Link className="button" href="/login">Créer mon premier radar</Link>
            <a className="button-secondary" href="#plans">Voir les plans</a>
          </div>
        </div>
        <div className="card border-mint/20">
          <div className="mb-4 text-sm font-bold text-mint">🚨 OPPORTUNITÉ DÉTECTÉE</div>
          <h2 className="text-2xl font-bold">TAG Heuer Professional vintage</h2>
          <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
            <Metric label="Prix livré" value="674 CHF" />
            <Metric label="Revente estimée" value="980 CHF" />
            <Metric label="Bénéfice net" value="+159 CHF" green />
            <Metric label="Score" value="82/100" />
          </div>
          <p className="mt-5 rounded-xl bg-orange-400/10 p-3 text-sm text-orange-200">
            ⚠️ Authenticité et historique de révision à vérifier avant achat.
          </p>
        </div>
      </section>
      <section id="plans" className="mx-auto grid max-w-6xl gap-4 px-6 pb-20 md:grid-cols-3">
        {[
          ["Free", "2 radars • 10 alertes/jour • scan 6h"],
          ["Pro", "20 radars • 200 alertes/jour • scan 30 min"],
          ["Business", "Radars équipe • API • import B2B"]
        ].map(([name, detail]) => <div className="card" key={name}><h3 className="text-xl font-bold">{name}</h3><p className="mt-2 text-slate-400">{detail}</p></div>)}
      </section>
    </main>
  );
}

function Metric({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return <div className="rounded-xl bg-black/20 p-3"><div className="text-slate-400">{label}</div><div className={`mt-1 text-xl font-bold ${green ? "text-mint" : ""}`}>{value}</div></div>;
}
