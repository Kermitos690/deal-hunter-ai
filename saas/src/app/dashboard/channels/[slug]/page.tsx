import Link from "next/link";
import { notFound } from "next/navigation";
import { ChannelSubscribeButton } from "@/components/channel-subscribe-button";
import { SponsoredPlacementCard } from "@/components/sponsored-placement-card";
import { channelFeed } from "@/lib/channels/server";
import { requireUser } from "@/lib/security/session";

export const dynamic = "force-dynamic";

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function ChannelPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  if (process.env.ENABLE_CHANNELS !== "true") notFound();
  const { slug } = await params;
  const feed = await channelFeed(user, slug);
  if (!feed) notFound();

  return <div className="mx-auto max-w-5xl space-y-6">
    <Link className="text-sm text-slate-400 hover:text-white" href="/dashboard/channels">← Tous les canaux</Link>
    <header className="card">
      <div className="text-xs font-black uppercase tracking-[.16em] text-cyan">{feed.channel.category ?? "Canal"}</div>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-black">{feed.channel.name}</h1>
          <p className="mt-2 leading-6 text-slate-400">{feed.channel.description}</p>
        </div>
        <div className="w-full max-w-xs">
          <ChannelSubscribeButton
            slug={feed.channel.slug}
            initialSubscribed={Boolean(feed.subscription)}
            initialMode={feed.subscription?.notification_mode}
          />
        </div>
      </div>
    </header>

    {feed.sponsored ? <SponsoredPlacementCard campaign={feed.sponsored} channelId={feed.channel.id} /> : null}

    <section className="grid gap-5">
      {feed.posts.length === 0 ? <div className="card text-slate-400">Aucune publication pour le moment. Les premiers deals seront ajoutés après validation éditoriale.</div> : feed.posts.map((post: any) => {
        const product = first(post.products);
        const score = first(post.deal_scores);
        return <article className="card overflow-hidden" key={post.id}>
          <div className="grid gap-5 md:grid-cols-[180px_1fr]">
            {post.image_url ? <img className="h-44 w-full rounded-xl object-cover" src={post.image_url} alt="" /> : <div className="grid h-44 place-items-center rounded-xl bg-white/[.04] text-4xl">🔎</div>}
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="badge">{post.post_type === "editorial" ? "Éditorial" : "Deal vérifié"}</span>
                {score?.market_confidence ? <span className="badge">Confiance {score.market_confidence}</span> : null}
              </div>
              <h2 className="mt-3 text-xl font-black">{post.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{post.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                {score?.total_score != null ? <span className="badge">Score {score.total_score}/100</span> : null}
                {score?.estimated_net_profit != null ? <span className="badge">Marge {Number(score.estimated_net_profit).toFixed(0)} CHF</span> : null}
                {score?.estimated_roi_percent != null ? <span className="badge">ROI {Number(score.estimated_roi_percent).toFixed(1)} %</span> : null}
                {product?.condition_grade ? <span className="badge">État {product.condition_grade}</span> : null}
                {product?.source ? <span className="badge">{product.source}</span> : null}
              </div>
              {post.destination_url ? <a className="button mt-5 inline-flex" href={post.destination_url} target="_blank" rel="noreferrer nofollow">Ouvrir l’annonce</a> : null}
            </div>
          </div>
        </article>;
      })}
    </section>
  </div>;
}
