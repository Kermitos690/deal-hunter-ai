import Link from "next/link";

export default function PartnersPage() {
  return <main className="mx-auto max-w-5xl p-6 py-12 md:p-12">
    <nav className="flex items-center justify-between"><Link href="/" className="text-slate-400">← Accueil</Link><Link className="button-secondary" href="/methodologie">Méthodologie</Link></nav>
    <div className="mt-10 badge text-mint">PARTENARIATS CATALOGUE B2B</div>
    <h1 className="mt-4 max-w-4xl text-4xl font-black md:text-6xl">Transformons votre catalogue en demande professionnelle qualifiée.</h1>
    <p className="mt-6 max-w-3xl text-lg text-slate-300">Deal Hunter AI documente la rentabilité, le niveau de preuve et les risques avant de diriger ses utilisateurs vers les stocks partenaires éligibles.</p>
    <section className="mt-10 grid gap-4 md:grid-cols-3">
      <Card title="Pilote contrôlé">30 à 90 jours, catégories et territoires limités.</Card>
      <Card title="Lecture seule">Aucune commande automatique pendant la validation.</Card>
      <Card title="Mesurable">Demande correspondante et intérêt sortant agrégés.</Card>
    </section>
    <section className="card mt-8"><h2 className="text-2xl font-black">Formats acceptés</h2><p className="mt-3 text-slate-300">REST, SOAP, CSV, XML, JSON, XLSX, URL planifiée ou SFTP. Un échantillon de 20 à 100 produits suffit pour commencer la cartographie.</p><div className="mt-5 flex flex-wrap gap-3"><a className="button" href="mailto:dealhunter680@gmail.com?subject=Partenariat%20catalogue%20B2B%20-%20Deal%20Hunter%20AI">Proposer un catalogue</a><a className="button-secondary" href="/deal-hunter-ai-b2b-partnership.pdf">Télécharger le dossier</a></div></section>
    <section className="mt-8 grid gap-5 md:grid-cols-2"><Card title="Ce que nous demandons">Catalogue, prix professionnel, stock, images autorisées, logistique, MOQ, retours et restrictions.</Card><Card title="Ce que nous apportons">Demande qualifiée, visibilité contrôlée, intégration technique et rapport de pilote agrégé.</Card></section>
    <p className="mt-8 text-sm text-slate-500">Les restrictions de marque, territoire, canal, affichage et conservation peuvent être appliquées fournisseur par fournisseur.</p>
  </main>;
}
function Card({title,children}:{title:string;children:React.ReactNode}) { return <div className="card"><h2 className="text-xl font-bold">{title}</h2><p className="mt-2 text-slate-300">{children}</p></div>; }
