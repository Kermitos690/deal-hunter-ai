"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AdminChannelsConsole({
  channels,
  campaigns
}: {
  channels: Array<{ id: string; name: string; slug: string }>;
  campaigns: any[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function postJson(url: string, payload: unknown, method = "POST") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Action impossible.");
      setMessage("Action enregistrée.");
      router.refresh();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action impossible.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const created = await postJson("/api/admin/sponsored-campaigns", {
      sponsorName: form.get("sponsorName"),
      websiteUrl: form.get("websiteUrl"),
      contactEmail: form.get("contactEmail"),
      channelId: form.get("channelId") || null,
      category: form.get("category") || null,
      name: form.get("name"),
      headline: form.get("headline"),
      body: form.get("body"),
      imageUrl: form.get("imageUrl"),
      destinationUrl: form.get("destinationUrl"),
      startsAt: form.get("startsAt") || null,
      endsAt: form.get("endsAt") || null,
      impressionLimit: form.get("impressionLimit"),
      clickLimit: form.get("clickLimit"),
      dailyFrequencyCap: Number(form.get("dailyFrequencyCap") || 1)
    });
    if (created) event.currentTarget.reset();
  }

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const created = await postJson("/api/admin/channel-posts", {
      channelId: form.get("channelId"),
      title: form.get("title"),
      summary: form.get("summary"),
      imageUrl: form.get("imageUrl"),
      destinationUrl: form.get("destinationUrl"),
      expiresAt: form.get("expiresAt") || null
    });
    if (created) event.currentTarget.reset();
  }

  return <div className="space-y-7">
    {message ? <div className="rounded-xl border border-white/10 bg-white/[.04] p-3 text-sm">{message}</div> : null}

    <section className="card">
      <h2 className="text-xl font-black">Publier dans un canal</h2>
      <p className="mt-1 text-sm text-slate-400">Publication éditoriale contrôlée. Aucune donnée privée de radar n’est copiée.</p>
      <form className="mt-5 grid gap-4" onSubmit={createPost}>
        <SelectChannel channels={channels} />
        <input className="input" name="title" required minLength={4} placeholder="Titre de la publication" />
        <textarea className="input min-h-28" name="summary" placeholder="Résumé, contexte marché, précautions…" />
        <div className="grid gap-4 md:grid-cols-2">
          <input className="input" name="imageUrl" type="url" placeholder="URL image (facultatif)" />
          <input className="input" name="destinationUrl" type="url" placeholder="Lien externe (facultatif)" />
        </div>
        <input className="input" name="expiresAt" type="datetime-local" />
        <button className="button" disabled={busy}>Publier</button>
      </form>
    </section>

    <section className="card">
      <h2 className="text-xl font-black">Créer une campagne sponsorisée</h2>
      <p className="mt-1 text-sm text-slate-400">La campagne commence en brouillon. Une action séparée est requise pour l’approuver et l’activer.</p>
      <form className="mt-5 grid gap-4" onSubmit={createCampaign}>
        <div className="grid gap-4 md:grid-cols-3">
          <input className="input" name="sponsorName" required placeholder="Nom du sponsor" />
          <input className="input" name="websiteUrl" type="url" placeholder="Site du sponsor" />
          <input className="input" name="contactEmail" type="email" placeholder="Contact" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <input className="input" name="name" required placeholder="Nom interne de campagne" />
          <SelectChannel channels={channels} optional />
        </div>
        <input className="input" name="category" placeholder="Catégorie si aucun canal précis" />
        <input className="input" name="headline" required minLength={4} placeholder="Titre visible" />
        <textarea className="input min-h-24" name="body" placeholder="Texte visible" />
        <div className="grid gap-4 md:grid-cols-2">
          <input className="input" name="imageUrl" type="url" placeholder="URL image" />
          <input className="input" name="destinationUrl" required type="url" placeholder="URL de destination" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm">Début<input className="input" name="startsAt" type="datetime-local" /></label>
          <label className="grid gap-2 text-sm">Fin<input className="input" name="endsAt" type="datetime-local" /></label>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <input className="input" name="impressionLimit" min="0" type="number" placeholder="Plafond impressions" />
          <input className="input" name="clickLimit" min="0" type="number" placeholder="Plafond clics" />
          <input className="input" name="dailyFrequencyCap" min="1" max="20" type="number" defaultValue="1" aria-label="Fréquence par jour" />
        </div>
        <button className="button" disabled={busy}>Créer le brouillon</button>
      </form>
    </section>

    <section className="card">
      <h2 className="text-xl font-black">Campagnes</h2>
      <div className="mt-5 grid gap-4">
        {campaigns.length === 0 ? <p className="text-slate-400">Aucune campagne.</p> : campaigns.map((campaign) => <article className="rounded-xl border border-white/10 bg-white/[.03] p-4" key={campaign.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-black">{campaign.name}</div>
              <div className="mt-1 text-sm text-slate-400">{campaign.headline}</div>
              <div className="mt-2 text-xs text-slate-500">{campaign.sponsors?.name ?? "Sponsor"} · {campaign.channels?.name ?? campaign.category ?? "Tous canaux compatibles"}</div>
            </div>
            <span className="badge">{campaign.status}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="badge">{campaign.impressions_count} impressions</span><span className="badge">{campaign.clicks_count} clics</span></div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["approved", "active", "paused", "ended", "rejected"] as const).map((status) => <button className="button-secondary text-xs" disabled={busy || campaign.status === status} key={status} type="button" onClick={() => postJson(`/api/admin/sponsored-campaigns/${campaign.id}`, { status }, "PATCH")}>{status}</button>)}
          </div>
        </article>)}
      </div>
    </section>
  </div>;
}

function SelectChannel({ channels, optional = false }: { channels: Array<{ id: string; name: string }>; optional?: boolean }) {
  return <select className="input" name="channelId" required={!optional} defaultValue="">
    <option value="">{optional ? "Tous les canaux d’une catégorie" : "Choisir un canal"}</option>
    {channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
  </select>;
}
