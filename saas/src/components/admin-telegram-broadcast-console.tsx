"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { BroadcastSummary } from "@/telegram/broadcast";

export function AdminTelegramBroadcastConsole({ broadcasts }: { broadcasts: BroadcastSummary[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState<Record<string, string>>({});

  async function json(url: string, payload?: unknown) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload ?? {})
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Action impossible.");
    return body;
  }

  async function prepareAndPreviewRelease() {
    setBusy(true);
    setMessage("Préparation du message de version…");
    try {
      const created = await json("/api/admin/telegram-broadcasts", { template: "release" });
      const preview = await json(`/api/admin/telegram-broadcasts/${created.broadcast.broadcast_id}/preview`);
      setMessage(`✅ Aperçu envoyé uniquement à ${preview.recipient}. Vérifie maintenant ton chat Telegram.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Aperçu impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function createCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await json("/api/admin/telegram-broadcasts", {
        title: form.get("title"),
        content_html: form.get("content_html"),
        audience: form.get("audience"),
        button_label: form.get("button_label") || null,
        button_url: form.get("button_url") || null
      });
      event.currentTarget.reset();
      setMessage("✅ Brouillon créé. Envoie d’abord un aperçu à ton compte.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function preview(id: string) {
    setBusy(true);
    setMessage("Envoi de l’aperçu…");
    try {
      const result = await json(`/api/admin/telegram-broadcasts/${id}/preview`);
      setMessage(`✅ Aperçu envoyé uniquement à ${result.recipient}.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Aperçu impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function dispatch(id: string) {
    if (confirmation[id] !== "DIFFUSER") {
      setMessage("Écris exactement DIFFUSER avant l’envoi général.");
      return;
    }
    if (!window.confirm("Confirmer la diffusion Telegram à tous les destinataires éligibles ?")) return;
    setBusy(true);
    setMessage("🚀 Diffusion en cours… ne ferme pas cette page.");
    try {
      let hasMore = true;
      let first = true;
      let total = 0;
      while (hasMore) {
        const result = await json(`/api/admin/telegram-broadcasts/${id}/dispatch`, {
          confirmation: "DIFFUSER",
          batch_size: 25,
          approve: first
        });
        first = false;
        total += Number(result.processed ?? 0);
        hasMore = Boolean(result.hasMore);
        setMessage(`🚀 Diffusion en cours : ${total} destinataire(s) traité(s), ${result.remaining ?? 0} restant(s).`);
        if (hasMore) await new Promise((resolve) => setTimeout(resolve, 500));
      }
      setMessage(`✅ Diffusion terminée. ${total} destinataire(s) traité(s). Consulte les statistiques ci-dessous.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Diffusion interrompue.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-7">
    {message ? <div className="rounded-xl border border-white/10 bg-white/[.04] p-4 text-sm">{message}</div> : null}

    <section className="card border-mint/20">
      <div className="badge text-mint">NOUVELLE VERSION</div>
      <h2 className="mt-3 text-2xl font-black">Annonce recherche intelligente</h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-400">Message multilingue factuel sur l’amélioration des recherches eBay, Ricardo, Anibis, Tutti et Komehyo, ainsi que la nouvelle navigation Telegram. Aucun deal n’est promis.</p>
      <button className="button mt-5" disabled={busy} onClick={prepareAndPreviewRelease} type="button">
        🧪 Envoyer la nouvelle version uniquement à mon compte
      </button>
    </section>

    <section className="card">
      <h2 className="text-xl font-black">Créer une autre communication</h2>
      <p className="mt-1 text-sm text-slate-400">Telegram HTML autorisé : &lt;b&gt;, &lt;i&gt;, &lt;code&gt; et liens. Maximum 3 900 caractères.</p>
      <form className="mt-5 grid gap-4" onSubmit={createCustom}>
        <input className="input" name="title" required minLength={3} maxLength={100} placeholder="Titre interne" />
        <textarea className="input min-h-56" name="content_html" required minLength={10} maxLength={3900} placeholder="🚀 <b>Titre visible</b>\n\nTon message…" />
        <div className="grid gap-4 md:grid-cols-3">
          <select className="input" name="audience" defaultValue="all_started">
            <option value="all_started">Tous les comptes ayant utilisé le bot</option>
            <option value="active_free">Utilisateurs Free actifs</option>
            <option value="active_paid">Utilisateurs Pro / Business actifs</option>
          </select>
          <input className="input" name="button_label" maxLength={40} placeholder="Texte du bouton externe" />
          <input className="input" name="button_url" type="url" placeholder="https://…" />
        </div>
        <button className="button-secondary" disabled={busy}>Créer le brouillon</button>
      </form>
    </section>

    <section className="card">
      <h2 className="text-xl font-black">Campagnes Telegram</h2>
      <p className="mt-1 text-sm text-slate-400">Un aperçu est obligatoire avant toute diffusion générale. Les comptes ayant bloqué le bot sont ensuite exclus automatiquement.</p>
      <div className="mt-5 grid gap-4">
        {broadcasts.length === 0 ? <p className="text-slate-400">Aucune campagne.</p> : broadcasts.map((broadcast) => <article className="rounded-2xl border border-white/10 bg-white/[.03] p-5" key={broadcast.broadcast_id}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="font-black">{broadcast.title}</div>
              <div className="mt-1 text-xs text-slate-500">Créée le {new Date(broadcast.created_at).toLocaleString("fr-CH")} · cible {audienceLabel(broadcast.audience)}</div>
              <pre className="mt-4 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950/70 p-4 text-xs text-slate-300">{broadcast.content_html.replace(/<[^>]+>/g, "")}</pre>
            </div>
            <span className={`badge ${broadcast.status === "completed" ? "text-mint" : broadcast.status === "partial" ? "text-amber-200" : ""}`}>{statusLabel(broadcast.status)}</span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-5">
            <Metric label="Cible" value={broadcast.target_count} />
            <Metric label="Envoyés" value={broadcast.sent_count} good />
            <Metric label="Échecs" value={broadcast.failed_count} danger={broadcast.failed_count > 0} />
            <Metric label="Bot bloqué" value={broadcast.blocked_count} danger={broadcast.blocked_count > 0} />
            <Metric label="Ignorés" value={broadcast.skipped_count} />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button className="button-secondary" disabled={busy} onClick={() => preview(broadcast.broadcast_id)} type="button">🧪 Envoyer à mon compte</button>
            {broadcast.preview_sent_at ? <span className="text-xs text-mint">✅ Aperçu envoyé {new Date(broadcast.preview_sent_at).toLocaleString("fr-CH")}</span> : <span className="text-xs text-amber-200">Aperçu obligatoire</span>}
          </div>

          {broadcast.preview_sent_at && !broadcast.completed_at ? <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[.04] p-4">
            <div className="text-sm font-bold">Validation finale avant diffusion</div>
            <div className="mt-3 flex flex-wrap gap-3">
              <input className="input max-w-xs" value={confirmation[broadcast.broadcast_id] ?? ""} onChange={(event) => setConfirmation((current) => ({ ...current, [broadcast.broadcast_id]: event.target.value }))} placeholder="Écrire DIFFUSER" />
              <button className="button" disabled={busy || confirmation[broadcast.broadcast_id] !== "DIFFUSER"} onClick={() => dispatch(broadcast.broadcast_id)} type="button">🚀 Diffuser à toute la cible</button>
            </div>
          </div> : null}
        </article>)}
      </div>
    </section>
  </div>;
}

function Metric({ label, value, good, danger }: { label: string; value: number; good?: boolean; danger?: boolean }) {
  return <div className="rounded-xl bg-white/[.04] p-3"><div className="text-xs text-slate-500">{label}</div><div className={`mt-1 text-xl font-black ${good ? "text-mint" : danger ? "text-red-300" : ""}`}>{value}</div></div>;
}

function audienceLabel(value: BroadcastSummary["audience"]) {
  if (value === "active_free") return "Free actifs";
  if (value === "active_paid") return "Pro / Business actifs";
  return "tous les utilisateurs du bot";
}

function statusLabel(value: BroadcastSummary["status"]) {
  const labels: Record<BroadcastSummary["status"], string> = {
    draft: "Brouillon",
    preview_sent: "Aperçu envoyé",
    approved: "Validée",
    sending: "En cours",
    completed: "Terminée",
    partial: "Terminée avec erreurs"
  };
  return labels[value];
}
