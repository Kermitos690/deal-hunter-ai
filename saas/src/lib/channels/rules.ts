import type { DealScore, Plan, ProductCandidate } from "@/types";

export type ChannelPublication = {
  slug: string;
  reason: string;
};

export type SponsoredCampaignInput = {
  sponsorName: string;
  websiteUrl?: string | null;
  contactEmail?: string | null;
  channelId?: string | null;
  category?: string | null;
  name: string;
  headline: string;
  body?: string | null;
  imageUrl?: string | null;
  destinationUrl: string;
  startsAt?: string | null;
  endsAt?: string | null;
  impressionLimit?: number | null;
  clickLimit?: number | null;
  dailyFrequencyCap?: number | null;
};

function normalized(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function pokemonAttributes(candidate: ProductCandidate) {
  const attributes = candidate.verticalAttributes ?? candidate.rawPayload?.pokemonTcg;
  if (!attributes || typeof attributes !== "object") return null;
  return attributes as Record<string, unknown>;
}

export function channelTargetsForDeal(candidate: ProductCandidate, score: DealScore): ChannelPublication[] {
  if (score.recommendation === "AVOID" || score.totalScore < 55 || score.estimatedNetProfit < 25) return [];
  const targets: ChannelPublication[] = [];
  const category = normalized(candidate.category);
  const title = normalized(candidate.title);
  const attributes = pokemonAttributes(candidate);
  const isPokemon = attributes?.franchise === "pokemon" || /pokemon|pokémon/.test(title);

  if (isPokemon) {
    targets.push({ slug: "pokemon-general", reason: "pokemon_deal" });
    const releaseYear = Number(attributes?.releaseYear ?? 0);
    const productType = String(attributes?.productType ?? "");
    if (releaseYear === 2025 || releaseYear === 2026) {
      targets.push({ slug: "pokemon-2025-2026", reason: "recent_release" });
    }
    if (productType === "GRADED_CARD") targets.push({ slug: "pokemon-graded", reason: "graded_card" });
    if (productType === "SEALED_PRODUCT") targets.push({ slug: "pokemon-sealed", reason: "sealed_product" });
    if (productType === "LOT_COLLECTION") targets.push({ slug: "pokemon-boutiques", reason: "shop_lot" });
    if ((releaseYear > 0 && releaseYear <= 2003) || /base set|1st edition|premiere edition|vintage/.test(title)) {
      targets.push({ slug: "pokemon-vintage", reason: "vintage_card" });
    }
  }

  if (/montre|watch/.test(category) || /watch|montre|seiko|omega|rolex|tissot|longines/.test(title)) {
    targets.push({ slug: "montres-opportunites", reason: "watch_deal" });
  }

  return [...new Map(targets.map((target) => [target.slug, target])).values()];
}

export function sponsoredPlacementsAllowedForPlan(
  plan: Plan,
  options: { enabled: boolean; showOnPaidPlans?: boolean }
) {
  if (!options.enabled) return false;
  if (plan === "free") return true;
  return options.showOnPaidPlans === true;
}

export function safeSponsoredDestination(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function validateSponsoredCampaignInput(input: SponsoredCampaignInput) {
  const errors: string[] = [];
  if (input.sponsorName.trim().length < 2) errors.push("Nom du sponsor requis.");
  if (input.name.trim().length < 2) errors.push("Nom de campagne requis.");
  if (input.headline.trim().length < 4) errors.push("Titre publicitaire trop court.");
  if (!safeSponsoredDestination(input.destinationUrl)) errors.push("URL de destination invalide.");
  if (input.startsAt && input.endsAt && new Date(input.startsAt) >= new Date(input.endsAt)) {
    errors.push("La fin de campagne doit être postérieure au début.");
  }
  const cap = input.dailyFrequencyCap ?? 1;
  if (!Number.isInteger(cap) || cap < 1 || cap > 20) errors.push("Fréquence quotidienne invalide.");
  if (input.impressionLimit != null && input.impressionLimit < 0) errors.push("Plafond d’impressions invalide.");
  if (input.clickLimit != null && input.clickLimit < 0) errors.push("Plafond de clics invalide.");
  return { valid: errors.length === 0, errors };
}
