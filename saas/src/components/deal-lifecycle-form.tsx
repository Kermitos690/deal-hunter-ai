"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function DealLifecycleForm({ dealId, saved }: { dealId: string; saved?: any }) {
  const router = useRouter();
  const [status, setStatus] = useState(saved?.lifecycle_status ?? "saved");
  const [error, setError] = useState("");
  const needsBuy = ["purchased", "listed", "sold"].includes(status);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const number = (key: string) => form.get(key) ? Number(form.get(key)) : undefined;
    const response = await fetch(`/api/deals/${dealId}/lifecycle`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status,
        actualBuyPrice: number("actualBuyPrice"),
        actualSalePrice: number("actualSalePrice"),
        actualFees: number("actualFees"),
        notes: form.get("notes") || undefined
      })
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Enregistrement impossible.");
      return;
    }
    router.refresh();
  }

  return <form className="mt-4 space-y-4" onSubmit={submit}>
    <label className="block text-sm">Statut
      <select className="input mt-1" value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="saved">À étudier</option><option value="purchased">Acheté</option>
        <option value="listed">Mis en vente</option><option value="sold">Revendu</option>
        <option value="abandoned">Abandonné</option>
      </select>
    </label>
    {needsBuy && <label className="block text-sm">Prix d’achat réel (CHF)<input className="input mt-1" name="actualBuyPrice" type="number" min="0.01" step="0.01" required defaultValue={saved?.actual_buy_price ?? ""} /></label>}
    {status === "sold" && <div className="grid gap-4 md:grid-cols-2"><label className="block text-sm">Prix de revente réel (CHF)<input className="input mt-1" name="actualSalePrice" type="number" min="0.01" step="0.01" required defaultValue={saved?.actual_sale_price ?? ""} /></label><label className="block text-sm">Frais réels totaux (CHF)<input className="input mt-1" name="actualFees" type="number" min="0" step="0.01" defaultValue={saved?.actual_fees ?? 0} /></label></div>}
    <label className="block text-sm">Notes<textarea className="input mt-1 min-h-24" name="notes" maxLength={2000} defaultValue={saved?.notes ?? ""} /></label>
    {error && <p className="text-sm text-red-300">{error}</p>}
    <button className="button" type="submit">Enregistrer le résultat réel</button>
  </form>;
}
