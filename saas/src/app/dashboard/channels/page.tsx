import Link from "next/link";
import { ChannelSubscribeButton } from "@/components/channel-subscribe-button";
import { listChannelsForUser } from "@/lib/channels/server";
import { requireUser } from "@/lib/security/session";

export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  const user = await requireUser();
  if (process.env.ENABLE_CHANNELS !== "true") {
    return <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-black">Canaux Deal Hunter</h1>
      <div className="card mt-6">
        <div className="text-lg font-bold">Canaux préparés, activation en cours</div>
        <p className="mt-2 text-slate-400">La fonctionnalité restera masquée tant que la migration et les règles éditoriales ne sont pas activées.</p>
      </div>
    </div>;
  }

  const channels = await listChannelsForUser(user.id);
  return <div className="mx-auto max-w-6xl space-y-7">
    <div>
      <div className="text-sm font-black uppercase tracking-[.18em] text-mint">Flux spécialisés</div>
      <h1 className="mt-2 text-4xl font-black">Canaux Deal Hunter</h1>
      <p className="mt-3 max-w-3xl text-slate-400">Suis uniquement les verticales qui t’intéressent. Les canaux publics ne révèlent jamais le radar, le compte ou les critères privés à l’origine d’une opportunité.</p>
    </div>

    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {channels.map((channel: any) => <article className="card flex flex-col" key={channel.id}>
        <div className="text-xs font-bold uppercase tracking-[.12em] text-cyan">{channel.category ?? "Sélection"}</div>
        <h2 className="mt-2 text-xl font-black">{channel.name}</h2>
        <p className="mt-2 flex-1 text-sm leading-6 text-slate-400">{channel.description}</p>
        <div className="mt-5 grid gap-3">
          <Link className="button-secondary text-center" href={`/dashboard/channels/${channel.slug}`}>Ouvrir le canal</Link>
          <ChannelSubscribeButton slug={channel.slug} initialSubscribed={channel.subscribed} initialMode={channel.notificationMode} />
        </div>
      </article>)}
    </div>

    <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5 text-sm leading-6 text-slate-400">
      Les cartes marquées <strong className="text-amber-100">Sponsorisé</strong> sont des publicités. Elles restent visuellement séparées des deals et ne participent jamais au score ou au classement.
    </section>
  </div>;
}
