"use client";

import { useState } from "react";

export function ReferralShare({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function share() {
    const data = {
      title: "Deal Hunter AI",
      text: "Teste Deal Hunter AI avec mon lien. Si tu t’abonnes, je reçois un mois gratuit.",
      url
    };
    if (navigator.share) {
      await navigator.share(data);
      return;
    }
    await copy();
  }

  return <div className="grid gap-3">
    <input className="input" readOnly value={url} aria-label="Lien de parrainage" />
    <div className="flex flex-wrap gap-3">
      <button className="button" type="button" onClick={share}>Partager le lien</button>
      <button className="button-secondary" type="button" onClick={copy}>{copied ? "Lien copié" : "Copier"}</button>
      <a className="button-secondary" href={url} target="_blank" rel="noreferrer">Ouvrir dans Telegram</a>
    </div>
  </div>;
}
