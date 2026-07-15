import Link from "next/link";
import { requireAdmin } from "@/lib/security/session";
import { AdminTelegramBroadcastConsole } from "@/components/admin-telegram-broadcast-console";
import { ensureReleaseBroadcast, listBroadcasts } from "@/telegram/broadcast";

export default async function AdminCommunicationsPage() {
  const admin = await requireAdmin();
  await ensureReleaseBroadcast(admin.id);
  const broadcasts = await listBroadcasts();

  return <main className="mx-auto max-w-6xl p-6 md:p-10">
    <Link href="/admin" className="text-slate-400">← Centre de contrôle</Link>
    <div className="mt-5">
      <div className="badge text-mint">COMMUNICATIONS</div>
      <h1 className="mt-3 text-4xl font-black">Diffusion Telegram</h1>
      <p className="mt-2 max-w-3xl text-slate-400">Prévisualise sur ton propre compte, valide, puis diffuse par lots avec suivi des succès, erreurs et blocages.</p>
    </div>
    <div className="mt-8"><AdminTelegramBroadcastConsole broadcasts={broadcasts} /></div>
  </main>;
}
