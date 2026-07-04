import Link from "next/link";

export default function MethodologiePage() {
  return <main className="mx-auto max-w-4xl p-6 py-12 md:p-12">
    <Link className="text-slate-400" href="/">← Accueil</Link>
    <div className="mt-6 badge text-mint">TRANSPARENCE DU MODÈLE</div>
    <h1 className="mt-4 text-4xl font-black">Méthodologie de décision</h1>
    <p className="mt-4 text-lg text-slate-300">Deal Hunter sépare le signal algorithmique de la décision professionnelle. Une marge élevée ne suffit jamais à valider un achat.</p>
    <div className="mt-8 grid gap-5">
      <Section title="1. Coût total d’acquisition">Prix, livraison, douane, réparation et TVA estimée sont intégrés avant le calcul de marge.</Section>
      <Section title="2. Valeur de revente">Les ventes conclues récentes sont prioritaires. Les annonces actives et signaux de marché sont pondérés à la baisse.</Section>
      <Section title="3. Niveau de preuve">A : données fortes et diversifiées. B : plusieurs ventes comparables. C : signaux limités. D : aucune preuve suffisante.</Section>
      <Section title="4. Décision">« Validé » exige rentabilité, preuve A/B et risque faible. « Sous conditions » impose les contrôles listés. « Revue requise » interdit toute décision automatique. « Écarté » signale une rentabilité ou un risque incompatible.</Section>
      <Section title="5. Limites">Les estimations ne garantissent ni authenticité, ni prix de vente, ni délai. La décision finale et les vérifications restent sous la responsabilité de l’utilisateur.</Section>
    </div>
  </main>;
}
function Section({title,children}:{title:string;children:React.ReactNode}) { return <section className="card"><h2 className="text-xl font-bold">{title}</h2><p className="mt-2 text-slate-300">{children}</p></section>; }
