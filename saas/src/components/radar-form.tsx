"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Radar } from "@/types";
import type { RadarTemplate } from "@/lib/radars/templates";
import { pokemonRadarConfigFromModels, pokemonRadarDirectives } from "@/lib/tcg/pokemon";

const split = (value: FormDataEntryValue | null) =>
  String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
const checked = (form: FormData, name: string) => form.getAll(name).map(String);

const CONDITIONS = [["NEW","Neuf"],["A","Excellent"],["B","Bon"],["C","Usagé"],["REPAIR","À réparer"],["UNKNOWN","Non précisé"]];
const SALE_TYPES = [["BUY_NOW","Achat immédiat"],["AUCTION","Enchère"]];
const SOURCES = [
  ["ebay","eBay mondial"],
  ["ricardo","Ricardo Suisse"],
  ["anibis","Anibis Suisse"],
  ["tutti","Tutti Suisse"],
  ["komehyo","KOMEHYO Japon"],
  ["email-alerts","Alertes e-mail"],
  ["rss","Flux maisons d’enchères"]
];
const COUNTRIES = [["CH","Suisse"],["FR","France"],["DE","Allemagne"],["IT","Italie"],["GB","Royaume-Uni"],["US","États-Unis"],["CA","Canada"],["AU","Australie"],["JP","Japon"],["EU","Autres pays UE"]];
const CATEGORIES = ["Montres","Sacs et accessoires","Sneakers","Cartes à collectionner","Bijoux","Électronique","Mode","Objets de collection","Pièces détachées","Autre"];
const POKEMON_PRODUCT_TYPES = [["RAW_SINGLE","Carte non gradée"],["GRADED_CARD","Carte gradée / slab"],["SEALED_PRODUCT","Produit scellé"],["LOT_COLLECTION","Lot / collection"],["ACCESSORY","Accessoire"]];
const POKEMON_GRADERS = [["PSA","PSA"],["BGS","BGS / Beckett"],["CGC","CGC"],["SGC","SGC"],["ACE","ACE"],["PCA","PCA"]];
const POKEMON_LANGUAGES = [["FR","Français"],["EN","Anglais"],["DE","Allemand"],["IT","Italien"],["ES","Espagnol"],["JP","Japonais"],["KR","Coréen"],["CN","Chinois"]];
const POKEMON_RELEASE_YEARS = [["2025","2025"],["2026","2026"],["1999","1999 / vintage"],["2000","2000"],["2001","2001"],["2002","2002"],["2003","2003"]];

export function RadarForm({initial,template}:{initial?:Partial<Radar>;template?:RadarTemplate}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const initialCategory = String(initial?.category ?? template?.category ?? "Montres");
  const [category, setCategory] = useState(initialCategory);
  const initialModels = (initial?.models ?? template?.models ?? []) as string[];
  const pokemonConfig = pokemonRadarConfigFromModels(initialModels);
  const configArray = (key: keyof typeof pokemonConfig, fallback: string[] = []) => {
    const value = pokemonConfig[key];
    return Array.isArray(value) ? value.map(String) : fallback;
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get("name"), category: form.get("category"),
      brands: split(form.get("brands")),
      models: [
        ...split(form.get("models")),
        ...(String(form.get("category")) === "Cartes à collectionner" ? pokemonRadarDirectives({
          productTypes: checked(form, "pokemon_product_types") as any,
          gradingCompanies: checked(form, "pokemon_grading_companies") as any,
          minimumGrade: form.get("pokemon_minimum_grade") ? Number(form.get("pokemon_minimum_grade")) : null,
          languages: checked(form, "pokemon_languages") as any,
          sets: split(form.get("pokemon_sets")),
          rarities: split(form.get("pokemon_rarities")),
          cardNumbers: split(form.get("pokemon_card_numbers")),
          releaseYears: checked(form, "pokemon_release_years").map(Number),
          includeFirstEdition: form.get("pokemon_first_edition") === "on",
          includePromos: form.get("pokemon_include_promos") === "on",
          includeUngraded: form.get("pokemon_include_ungraded") === "on",
          includeGraded: form.get("pokemon_include_graded") === "on"
        }) : [])
      ],
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
      auction_mode: checked(form, "sale_types").includes("AUCTION"),
      auction_reminder_enabled: form.get("auction_reminder_enabled") === "on",
      is_active: initial?.is_active ?? true
    };
    const endpoint=initial?.id?`/api/radars/${initial.id}`:"/api/radars";
    const response = await fetch(endpoint, { method: initial?.id?"PATCH":"POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    if (!response.ok) { setError(body.error ?? "Erreur"); setBusy(false); return; }
    router.push(`/dashboard/radars/${body.radar.id}`); router.refresh();
  }
  const value=<K extends keyof Radar>(key:K,fallback:any)=>initial?.[key]??template?.[key as keyof RadarTemplate]??fallback;
  const conditions=value("accepted_conditions",CONDITIONS.map(([v])=>v)) as string[];
  const saleTypes=value("sale_types",SALE_TYPES.map(([v])=>v)) as string[];
  const countries=value("source_countries",COUNTRIES.map(([v])=>v)) as string[];
  const sources=value("sources",["ebay","ricardo","anibis","tutti"]) as string[];
  return <form className="grid gap-7" onSubmit={submit}>
    <Section title="1. Produit recherché" hint="Décris ce que tu veux vraiment acheter. Marque + catégorie suffisent pour commencer.">
      <Field name="name" label="Nom du radar" required placeholder="Omega vintage à réparer" defaultValue={value("name",template?.title??"")} />
      <div className="grid gap-5 md:grid-cols-2">
        <Select name="category" label="Catégorie" options={CATEGORIES} value={category} onChange={(event)=>setCategory(event.target.value)} />
        <Field name="brands" label="Marques" placeholder="Omega, TAG Heuer" defaultValue={(value("brands",[]) as string[]).join(", ")} />
      </div>
      <Field name="models" label="Modèles ou références" placeholder="Seamaster, 136.005, Professional 2000" defaultValue={(value("models",[]) as string[]).filter((item)=>!item.startsWith("tcg:")).join(", ")} />
      <div className="grid gap-5 md:grid-cols-2"><Field name="include_keywords" label="Mots-clés obligatoires" defaultValue={(value("include_keywords",[]) as string[]).join(", ")} /><Field name="exclude_keywords" label="Mots à exclure" defaultValue={(value("exclude_keywords",["fake","replica","inspired","boîte seule"]) as string[]).join(", ")} /></div>
    </Section>
    {category === "Cartes à collectionner" && <Section title="2. Pokémon / Trading Cards" hint="Configure séparément cartes raw, slabs, produits scellés et lots. Les champs non renseignés restent ouverts pour une recherche large.">
      <ChoiceGroup title="Types de produits" name="pokemon_product_types" options={POKEMON_PRODUCT_TYPES} defaults={configArray("productTypes",["RAW_SINGLE","GRADED_CARD","SEALED_PRODUCT","LOT_COLLECTION"])} />
      <ChoiceGroup title="Sociétés de grading" name="pokemon_grading_companies" options={POKEMON_GRADERS} defaults={configArray("gradingCompanies",["PSA","BGS","CGC"])} />
      <div className="grid gap-5 md:grid-cols-3">
        <Field name="pokemon_minimum_grade" label="Grade minimum" type="number" min="1" max="10" step="0.5" defaultValue={String(pokemonConfig.minimumGrade ?? "")} placeholder="8" />
        <Field name="pokemon_sets" label="Sets / éditions" defaultValue={configArray("sets").join(", ")} placeholder="Prismatic Evolutions, Team Rocket" />
        <Field name="pokemon_card_numbers" label="Numéros de cartes" defaultValue={configArray("cardNumbers").join(", ")} placeholder="199/182, 4/102" />
      </div>
      <Field name="pokemon_rarities" label="Raretés" defaultValue={configArray("rarities").join(", ")} placeholder="SIR, SAR, alt art, secret rare" />
      <ChoiceGroup title="Langues" name="pokemon_languages" options={POKEMON_LANGUAGES} defaults={configArray("languages",["FR","EN","DE","IT","JP"])} />
      <ChoiceGroup title="Années / sorties à mettre en avant" name="pokemon_release_years" options={POKEMON_RELEASE_YEARS} defaults={configArray("releaseYears",["2025","2026"])} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Toggle name="pokemon_include_ungraded" label="Inclure les cartes raw" defaultChecked={pokemonConfig.includeUngraded !== false} />
        <Toggle name="pokemon_include_graded" label="Inclure les slabs" defaultChecked={pokemonConfig.includeGraded !== false} />
        <Toggle name="pokemon_include_promos" label="Inclure les promos" defaultChecked={pokemonConfig.includePromos !== false} />
        <Toggle name="pokemon_first_edition" label="Exiger 1re édition" defaultChecked={pokemonConfig.includeFirstEdition === true} />
      </div>
      <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
        Les annonces « proxy », fausses, cartes métal non officielles, codes numériques et mystery packs sont bloquées avant scoring.
      </div>
    </Section>}
    <Section title={category === "Cartes à collectionner" ? "3. Où chercher" : "2. Où chercher"} hint="Pour la Suisse, coche Ricardo et Anibis. Les annonces sans pays renseigné ne sont pas supprimées automatiquement.">
      <ChoiceGroup name="source_countries" options={COUNTRIES} defaults={countries} />
      <Select name="target_country" label="Pays de revente/livraison" options={["CH","FR","DE","IT","GB","US","CA","AU","JP"]} defaultValue={value("target_country","CH")} />
    </Section>
    <Section title={category === "Cartes à collectionner" ? "4. État et type de vente" : "3. État et type de vente"} hint="Pour explorer large, accepte tous les états et les deux types de vente.">
      <ChoiceGroup title="États acceptés" name="accepted_conditions" options={CONDITIONS} defaults={conditions} />
      <ChoiceGroup title="Types de vente" name="sale_types" options={SALE_TYPES} defaults={saleTypes} />
    </Section>
    <Section title={category === "Cartes à collectionner" ? "5. Sources" : "4. Sources"} hint="Ricardo, Anibis et Tutti sont lus en direct et vérifiés sur page détail avant scoring.">
      <ChoiceGroup name="sources" options={SOURCES} defaults={sources} />
      <div className="rounded-xl border border-mint/20 bg-mint/10 p-3 text-sm text-mint">
        Conseil : pour un radar Suisse, commence avec eBay + Ricardo + Anibis + Tutti. Ajoute KOMEHYO pour l’import Japon.
      </div>
    </Section>
    <Section title={category === "Cartes à collectionner" ? "6. Rentabilité et budget" : "5. Rentabilité et budget"} hint="Mode découverte : mets marge min 1 CHF, ROI 0 %, score 0 pour voir presque tout ce qui passe les filtres produit.">
      <div className="grid gap-5 md:grid-cols-3"><Field name="max_buy_price" label="Prix max CHF" type="number" required defaultValue={value("max_buy_price","")} /><Field name="total_budget" label="Budget total CHF" type="number" defaultValue={value("total_budget","")} /><Field name="min_profit" label="Marge min CHF" type="number" defaultValue={value("min_profit",30)} /></div>
      <div className="grid gap-5 md:grid-cols-3"><Field name="min_roi_percent" label="ROI min %" type="number" defaultValue={value("min_roi_percent",15)} /><Field name="min_score" label="Score min" type="number" defaultValue={value("min_score",70)} /><Field name="scan_frequency_minutes" label="Fréquence (min)" type="number" defaultValue={value("scan_frequency_minutes",360)} /></div>
      <div className="grid gap-5 md:grid-cols-3"><Field name="shipping_cost" label="Livraison CHF" type="number" defaultValue={value("shipping_cost",0)} /><Field name="customs_cost" label="Douane CHF" type="number" defaultValue={value("customs_cost",0)} /><Field name="repair_cost" label="Réparation CHF" type="number" defaultValue={value("repair_cost",0)} /></div>
      <div className="grid gap-5 md:grid-cols-3"><Field name="vat_rate" label="TVA %" type="number" defaultValue={Number(value("vat_rate",0))*100} /><Field name="platform_fee_rate" label="Commission plateforme %" type="number" defaultValue={Number(value("platform_fee_rate",.12))*100} /><Field name="payment_fee_rate" label="Commission paiement %" type="number" defaultValue={Number(value("payment_fee_rate",.03))*100} /></div>
    </Section>
    <Section title={category === "Cartes à collectionner" ? "7. Alertes" : "6. Alertes"}>
      <div className="grid gap-3 sm:grid-cols-2">{[["alerts_enabled","Alertes Telegram"],["photos_required","Photos obligatoires"],["auction_reminder_enabled","Rappel si une date d’enchère est disponible"]].map(([name,label]) => <label key={name} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3"><input name={name} type="checkbox" defaultChecked={Boolean(value(name as keyof Radar,true))}/>{label}</label>)}</div>
    </Section>
    {error && <p className="rounded-xl bg-red-500/10 p-3 text-red-300">{error}</p>}
    <button className="button" disabled={busy}>{busy ? "Enregistrement…" : initial?.id?"Enregistrer les modifications":"Créer le radar"}</button>
  </form>;
}

function Section({title,hint,children}:{title:string;hint?:string;children:React.ReactNode}) {
  return <fieldset className="grid gap-5 rounded-2xl border border-white/10 p-5"><legend className="px-2 text-lg font-black">{title}</legend>{hint&&<p className="-mt-2 text-sm text-slate-400">{hint}</p>}{children}</fieldset>;
}
function ChoiceGroup({title,name,options,defaults}:{title?:string;name:string;options:string[][];defaults:string[]}) {
  return <div><div className="mb-3 text-sm font-bold">{title}</div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{options.map(([value,label])=><label key={value} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3 text-sm"><input name={name} value={value} type="checkbox" defaultChecked={defaults.includes(value)} />{label}</label>)}</div></div>;
}
function Toggle({name,label,defaultChecked}:{name:string;label:string;defaultChecked:boolean}) {
  return <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] p-3 text-sm"><input name={name} type="checkbox" defaultChecked={defaultChecked}/>{label}</label>;
}
function Select({label,options,...props}:React.SelectHTMLAttributes<HTMLSelectElement>&{label:string;options:string[]}) {
  return <label className="grid gap-2 text-sm font-medium">{label}<select className="input" {...props}>{options.map((option)=><option key={option} value={option}>{option}</option>)}</select></label>;
}
function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...input } = props;
  return <label className="grid gap-2 text-sm font-medium">{label}<input className="input" {...input} /></label>;
}
