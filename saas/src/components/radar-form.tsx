"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const split = (value: FormDataEntryValue | null) =>
  String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
const checked = (form: FormData, name: string) => form.getAll(name).map(String);

const CONDITIONS = [["NEW","Neuf"],["A","Excellent"],["B","Bon"],["C","Usagé"],["REPAIR","À réparer"],["UNKNOWN","Non précisé"]];
const SALE_TYPES = [["BUY_NOW","Achat immédiat"],["AUCTION","Enchère"],["LOT","Lot"],["B2B","Professionnel"]];
const SOURCES = [["ebay","eBay mondial"],["email-alerts","Alertes e-mail"],["rss","Flux maisons d’enchères"]];
const COUNTRIES = [["CH","Suisse"],["FR","France"],["DE","Allemagne"],["IT","Italie"],["GB","Royaume-Uni"],["US","États-Unis"],["CA","Canada"],["AU","Australie"],["JP","Japon"],["EU","Union européenne"],["WORLD","Monde entier"]];
const CATEGORIES = ["Montres","Sacs et accessoires","Sneakers","Cartes à collectionner","Bijoux","Électronique","Mode","Objets de collection","Pièces détachées","Autre"];

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
      source_countries: checked(form, "source_countries"), target_country: form.get("target_country"),
      max_buy_price: form.get("max_buy_price"), total_budget: form.get("total_budget") || null,
      min_profit: form.get("min_profit"), min_roi_percent: form.get("min_roi_percent"),
      min_score: form.get("min_score"), accepted_conditions: checked(form, "accepted_conditions"),
      sale_types: checked(form, "sale_types"), sources: checked(form, "sources"),
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
  return <form className="grid gap-7" onSubmit={submit}>
    <Section title="1. Produit recherché" hint="Les champs libres restent utiles pour les marques et références exactes.">
      <Field name="name" label="Nom du radar" required placeholder="Omega vintage à réparer" />
      <div className="grid gap-5 md:grid-cols-2">
        <Select name="category" label="Catégorie" options={CATEGORIES} />
        <Field name="brands" label="Marques (séparées par virgules)" placeholder="Omega, TAG Heuer" />
      </div>
      <Field name="models" label="Modèles ou références" placeholder="Seamaster, 136.005, Professional 2000" />
      <div className="grid gap-5 md:grid-cols-2"><Field name="include_keywords" label="Mots-clés inclus" /><Field name="exclude_keywords" label="Mots-clés exclus" defaultValue="fake, replica, inspired, boîte seule" /></div>
    </Section>
    <Section title="2. Couverture géographique" hint="Tout est présélectionné pour maximiser la couverture mondiale.">
      <ChoiceGroup name="source_countries" options={COUNTRIES} defaults={COUNTRIES.map(([v])=>v)} />
      <Select name="target_country" label="Pays de livraison" options={["CH","FR","DE","IT","GB","US","CA","AU","JP"]} defaultValue="CH" />
    </Section>
    <Section title="3. État et type de vente" hint="Décoche uniquement ce que tu refuses absolument.">
      <ChoiceGroup title="États acceptés" name="accepted_conditions" options={CONDITIONS} defaults={CONDITIONS.map(([v])=>v)} />
      <ChoiceGroup title="Types de vente" name="sale_types" options={SALE_TYPES} defaults={SALE_TYPES.map(([v])=>v)} />
    </Section>
    <Section title="4. Sources interrogées" hint="Toutes les sources actuellement opérationnelles sont présélectionnées.">
      <ChoiceGroup name="sources" options={SOURCES} defaults={SOURCES.map(([v])=>v)} />
      <p className="text-xs text-slate-500">Yahoo Japan et StockX apparaîtront automatiquement après validation de leurs accès développeur.</p>
    </Section>
    <Section title="5. Rentabilité et budget">
      <div className="grid gap-5 md:grid-cols-3"><Field name="max_buy_price" label="Prix max CHF" type="number" required /><Field name="total_budget" label="Budget total CHF" type="number" /><Field name="min_profit" label="Marge min CHF" type="number" defaultValue="30" /></div>
      <div className="grid gap-5 md:grid-cols-3"><Field name="min_roi_percent" label="ROI min %" type="number" defaultValue="15" /><Field name="min_score" label="Score min" type="number" defaultValue="70" /><Field name="scan_frequency_minutes" label="Fréquence (min)" type="number" defaultValue="360" /></div>
      <div className="grid gap-5 md:grid-cols-3"><Field name="shipping_cost" label="Livraison CHF" type="number" defaultValue="0" /><Field name="customs_cost" label="Douane CHF" type="number" defaultValue="0" /><Field name="repair_cost" label="Réparation CHF" type="number" defaultValue="0" /></div>
      <div className="grid gap-5 md:grid-cols-3"><Field name="vat_rate" label="TVA %" type="number" defaultValue="0" /><Field name="platform_fee_rate" label="Commission plateforme %" type="number" defaultValue="12" /><Field name="payment_fee_rate" label="Commission paiement %" type="number" defaultValue="3" /></div>
    </Section>
    <Section title="6. Alertes">
      <div className="grid gap-3 sm:grid-cols-2">{[["alerts_enabled","Alertes Telegram"],["photos_required","Photos obligatoires"],["auction_mode","Mode enchère"],["auction_reminder_enabled","Rappel avant fin"]].map(([name,label]) => <label key={name} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3"><input name={name} type="checkbox" defaultChecked />{label}</label>)}</div>
    </Section>
    {error && <p className="rounded-xl bg-red-500/10 p-3 text-red-300">{error}</p>}
    <button className="button" disabled={busy}>{busy ? "Création…" : "Créer le radar complet"}</button>
  </form>;
}

function Section({title,hint,children}:{title:string;hint?:string;children:React.ReactNode}) {
  return <fieldset className="grid gap-5 rounded-2xl border border-white/10 p-5"><legend className="px-2 text-lg font-black">{title}</legend>{hint&&<p className="-mt-2 text-sm text-slate-400">{hint}</p>}{children}</fieldset>;
}
function ChoiceGroup({title,name,options,defaults}:{title?:string;name:string;options:string[][];defaults:string[]}) {
  return <div><div className="mb-3 text-sm font-bold">{title}</div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{options.map(([value,label])=><label key={value} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3 text-sm"><input name={name} value={value} type="checkbox" defaultChecked={defaults.includes(value)} />{label}</label>)}</div></div>;
}
function Select({label,options,...props}:React.SelectHTMLAttributes<HTMLSelectElement>&{label:string;options:string[]}) {
  return <label className="grid gap-2 text-sm font-medium">{label}<select className="input" {...props}>{options.map((option)=><option key={option} value={option}>{option}</option>)}</select></label>;
}
function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...input } = props;
  return <label className="grid gap-2 text-sm font-medium">{label}<input className="input" {...input} /></label>;
}
