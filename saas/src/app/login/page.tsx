import Link from "next/link";
import { telegramBotUsername, telegramStartUrl } from "@/lib/telegram-links";

export default function LoginPage() {
  const username = telegramBotUsername();
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
        href={telegramStartUrl("dashboard")}
        rel="noreferrer"
        target="_blank"
      >
        Ouvrir Telegram
      </a>
      <div className="mt-6 rounded-xl bg-black/20 p-4 text-left text-sm text-slate-300">
        <div className="font-bold">Si tu es bloqué :</div>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-400">
          <li>Ouvre <code>@{username}</code>.</li>
          <li>Envoie <code>/start</code>.</li>
          <li>Clique sur le bouton <b>Dashboard</b> envoyé par le bot.</li>
        </ol>
      </div>
      <p className="mt-6 text-xs text-slate-500">Aucun mot de passe n’est stocké.</p>
    </div>
  </main>;
}
