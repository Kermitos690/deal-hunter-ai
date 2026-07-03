import Link from "next/link";

export default function LoginPage() {
  const username = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "deal_hunter_cards_bot";
  return <main className="mx-auto flex min-h-screen max-w-lg items-center px-6">
    <div className="card w-full text-center">
      <Link href="/" className="text-sm text-slate-400">← Retour</Link>
      <h1 className="mt-4 text-3xl font-black">Connexion privée</h1>
      <p className="my-6 text-slate-400">
        Ouvre le bot, envoie <code>/start</code>, puis utilise son bouton Dashboard.
        Le lien signé est personnel et expire après 15 minutes.
      </p>
      <a
        className="inline-flex rounded-xl bg-cyan px-5 py-3 font-bold text-slate-950"
        href={`https://t.me/${username}?start=dashboard`}
      >
        Ouvrir Telegram
      </a>
      <p className="mt-6 text-xs text-slate-500">Aucun mot de passe n’est stocké.</p>
    </div>
  </main>;
}
