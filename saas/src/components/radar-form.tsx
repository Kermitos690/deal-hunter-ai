"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const split = (value: FormDataEntryValue | null) =>
  String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);

export function RadarForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get("name"), category: form.get("category"),
      brands: split(form.get("brands")), models: split(form.get("models")),
      include_keywords: split(form.get("include_keywords")),
      exclude_keywords: split(form.get("exclude_keywords")),
      source_countries: split(form.get("source_countries")), target_country: form.get("target_country"),
      max_buy_price: form.get("max_buy_price"), total_budget: form.get("total_budget") || null,
      min_profit: form.get("min_profit"), min_roi_percent: form.get("min_roi_percent"),
      min_score: form.get("min_score"), accepted_conditions: split(form.get("accepted_conditions")),
      sale_types: split(form.get("sale_types")), sources: split(form.get("sources")),
      shipping_cost: form.get("shipping_cost"), customs_cost: form.get("customs_cost"),
      vat_rate: Number(form.get("vat_rate")) / 100,
      platform_fee_rate: Number(form.get("platform_fee_rate")) / 100,
      payment_fee_rate: Number(form.get("payment_fee_rate")) / 100,
      repair_cost: form.get("repair_cost"), scan_frequency_minutes: form.get("scan_frequency_minutes"),
      alerts_enabled: form.get("alerts_enabled") === "on",
      photos_required: form.get("photos_required") === "on",
      auction_mode: form.get("auction_mode") === "on",
      auction_reminder_enabled: form.get("auction_reminder_enabled") === "on",
      is_active: true
    };
    const response = await fetch("/api/radars", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    if (!response.ok) { setError(body.error ?? "Erreur"); setBusy(false); return; }
    router.push(`/dashboard/radars/${body.radar.id}`); router.refresh();
  }
  return <form className="grid gap-5" onSubmit={submit}>
    <Field name="name" label="Nom du radar" required placeholder="Omega vintage à réparer" />
    <div className="grid gap-5 md:grid-cols-2"><Field name="category" label="Catégorie" required placeholder="montres" /><Field name="brands" label="Marques (séparées par virgules)" placeholder="Omega, TAG Heuer" /></div>
    <Field name="models" label="Modèles" placeholder="Seamaster, Professional 2000" />
    <div className="grid gap-5 md:grid-cols-2"><Field name="include_keywords" label="Mots-clés inclus" /><Field name="exclude_keywords" label="Mots-clés exclus" placeholder="fake, replica" /></div>
    <div className="grid gap-5 md:grid-cols-2"><Field name="source_countries" label="Pays sources" placeholder="CH, JP, DE" /><Field name="target_country" label="Pays cible" defaultValue="CH" /></div>
    <div className="grid gap-5 md:grid-cols-3"><Field name="max_buy_price" label="Prix max CHF" type="number" required /><Field name="total_budget" label="Budget total CHF" type="number" /><Field name="min_profit" label="Marge min CHF" type="number" defaultValue="30" /></div>
    <div className="grid gap-5 md:grid-cols-3"><Field name="min_roi_percent" label="ROI min %" type="number" defaultValue="15" /><Field name="min_score" label="Score min" type="number" defaultValue="70" /><Field name="scan_frequency_minutes" label="Fréquence (min)" type="number" defaultValue="360" /></div>
    <div className="grid gap-5 md:grid-cols-3"><Field name="shipping_cost" label="Livraison CHF" type="number" defaultValue="0" /><Field name="customs_cost" label="Douane CHF" type="number" defaultValue="0" /><Field name="repair_cost" label="Réparation CHF" type="number" defaultValue="0" /></div>
    <div className="grid gap-5 md:grid-cols-3"><Field name="vat_rate" label="TVA %" type="number" defaultValue="0" /><Field name="platform_fee_rate" label="Commission plateforme %" type="number" defaultValue="12" /><Field name="payment_fee_rate" label="Commission paiement %" type="number" defaultValue="3" /></div>
    <div className="grid gap-5 md:grid-cols-3"><Field name="accepted_conditions" label="États" defaultValue="NEW,A,B,C,REPAIR,UNKNOWN" /><Field name="sale_types" label="Types de vente" defaultValue="BUY_NOW,AUCTION,LOT,B2B" /><Field name="sources" label="Sources" defaultValue="mock" /></div>
    <div className="flex flex-wrap gap-5">{[["alerts_enabled","Alertes Telegram"],["photos_required","Photos obligatoires"],["auction_mode","Mode enchère"],["auction_reminder_enabled","Rappel enchère"]].map(([name,label]) => <label key={name} className="flex items-center gap-2"><input name={name} type="checkbox" defaultChecked={name !== "auction_mode" && name !== "auction_reminder_enabled"} />{label}</label>)}</div>
    {error && <p className="rounded-xl bg-red-500/10 p-3 text-red-300">{error}</p>}
    <button className="button" disabled={busy}>{busy ? "Création…" : "Créer le radar"}</button>
  </form>;
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...input } = props;
  return <label className="grid gap-2 text-sm font-medium">{label}<input className="input" {...input} /></label>;
}
