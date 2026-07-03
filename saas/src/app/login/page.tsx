import Link from "next/link";
import { TelegramLogin } from "@/components/telegram-login";

export default function LoginPage() {
  return <main className="mx-auto flex min-h-screen max-w-lg items-center px-6">
    <div className="card w-full text-center">
      <Link href="/" className="text-sm text-slate-400">← Retour</Link>
      <h1 className="mt-4 text-3xl font-black">Connexion privée</h1>
      <p className="my-6 text-slate-400">Telegram vérifie ton identité. Aucun mot de passe n’est stocké.</p>
      <TelegramLogin />
      <p className="mt-6 text-xs text-slate-500">Commence par /start dans le bot si ton compte n’existe pas encore.</p>
    </div>
  </main>;
}
