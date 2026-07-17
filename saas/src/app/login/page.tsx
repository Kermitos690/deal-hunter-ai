import Link from "next/link";
import { safeReturnPath } from "@/lib/security/return-path";
import { telegramBotUsername } from "@/lib/telegram-links";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const username = telegramBotUsername();
  const returnTo = safeReturnPath(params.next);
  const destinationLabel = returnTo.startsWith("/admin") ? "la page d’administration demandée" : "ton dashboard";
  const startUrl = `/api/auth/telegram/start?next=${encodeURIComponent(returnTo)}`;

  return <main className="mx-auto flex min-h-screen max-w-lg items-center px-6">
    <div className="card w-full text-center">
      <Link href="/" className="text-sm text-slate-400">← Retour</Link>
      <h1 className="mt-4 text-3xl font-black">Connexion privée</h1>
      <p className="my-6 text-slate-400">
        Ouvre le bot puis utilise son bouton Dashboard. Après validation, tu reviendras automatiquement vers {destinationLabel}.
        Le lien signé est personnel et expire après 15 minutes.
      </p>
      <a
        className="inline-flex rounded-xl bg-cyan px-5 py-3 font-bold text-slate-950"
        href={startUrl}
        rel="noreferrer"
      >
        Continuer dans Telegram
      </a>
      <div className="mt-6 rounded-xl bg-black/20 p-4 text-left text-sm text-slate-300">
        <div className="font-bold">Parcours attendu :</div>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-400">
          <li>Ouvre <code>@{username}</code> avec le bouton ci-dessus.</li>
          <li>Telegram affiche le menu Deal Hunter AI.</li>
          <li>Touche <b>Dashboard</b> : la page demandée s’ouvre directement.</li>
        </ol>
      </div>
      <p className="mt-4 break-all text-xs text-slate-500">Destination conservée : {returnTo}</p>
      <p className="mt-3 text-xs text-slate-500">Aucun mot de passe n’est stocké.</p>
    </div>
  </main>;
}
