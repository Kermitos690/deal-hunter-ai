import Link from "next/link";
import { AdminChannelsConsole } from "@/components/admin-channels-console";
import { serviceDb } from "@/lib/db/server";
import { requireAdmin } from "@/lib/security/session";

export const dynamic = "force-dynamic";

export default async function AdminChannelsPage() {
  await requireAdmin();
  if (process.env.ENABLE_CHANNELS !== "true") {
    return <main className="mx-auto max-w-5xl p-6 md:p-10">
      <Link className="text-slate-400" href="/admin">← Administration</Link>
      <h1 className="mt-4 text-3xl font-black">Canaux et sponsoring</h1>
      <div className="card mt-6"><p className="text-slate-400">Applique la migration puis active `ENABLE_CHANNELS=true` pour ouvrir le back-office.</p></div>
    </main>;
  }

  const db = serviceDb();
  const [{ data: channels, error: channelError }, { data: campaigns, error: campaignError }] = await Promise.all([
    db.from("channels").select("id,name,slug").order("sort_order", { ascending: true }),
    db.from("sponsored_campaigns")
      .select("id,name,headline,status,impressions_count,clicks_count,category,sponsors(name),channels(name)")
      .order("created_at", { ascending: false })
  ]);
  if (channelError) throw new Error(`Lecture canaux: ${channelError.message}`);
  if (campaignError) throw new Error(`Lecture campagnes: ${campaignError.message}`);

  return <main className="mx-auto max-w-6xl p-6 md:p-10">
    <Link className="text-slate-400" href="/admin">← Administration</Link>
    <div className="mt-4">
      <div className="badge text-amber-100">MONÉTISATION TRANSPARENTE</div>
      <h1 className="mt-3 text-4xl font-black">Canaux et sponsoring</h1>
      <p className="mt-2 max-w-3xl text-slate-400">Publie des contenus contrôlés et gère des campagnes distinctes du moteur de scoring. Une campagne ne devient visible qu’après approbation ou activation administrateur.</p>
    </div>
    <div className="mt-8">
      <AdminChannelsConsole channels={channels ?? []} campaigns={campaigns ?? []} />
    </div>
  </main>;
}
