export function SponsoredPlacementCard({
  campaign,
  channelId
}: {
  campaign: any;
  channelId: string;
}) {
  const sponsor = Array.isArray(campaign.sponsors) ? campaign.sponsors[0] : campaign.sponsors;
  return <aside className="overflow-hidden rounded-2xl border border-amber-300/30 bg-amber-300/10" aria-label="Contenu sponsorisé">
    {campaign.image_url ? <img className="h-48 w-full object-cover" src={campaign.image_url} alt="" /> : null}
    <div className="p-5">
      <div className="inline-flex rounded-full border border-amber-200/30 bg-black/20 px-3 py-1 text-xs font-black uppercase tracking-[.14em] text-amber-100">
        {campaign.disclosure_label || "Sponsorisé"}
      </div>
      <h2 className="mt-3 text-xl font-black">{campaign.headline}</h2>
      {campaign.body ? <p className="mt-2 text-sm leading-6 text-slate-300">{campaign.body}</p> : null}
      <div className="mt-3 text-xs text-slate-400">Annonceur : {sponsor?.name ?? "Partenaire Deal Hunter"}</div>
      <a
        className="button mt-4 inline-flex"
        href={`/go/sponsored/${campaign.id}?channel=${encodeURIComponent(channelId)}`}
        rel="nofollow sponsored"
      >
        Découvrir l’offre du sponsor
      </a>
      <p className="mt-3 text-xs leading-5 text-slate-500">Ce placement commercial est séparé des opportunités. Il ne modifie ni le score, ni le classement, ni la recommandation Deal Hunter AI.</p>
    </div>
  </aside>;
}
