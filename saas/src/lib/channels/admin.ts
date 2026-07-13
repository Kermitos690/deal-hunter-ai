import { serviceDb } from "@/lib/db/server";
import { channelsEnabled } from "./server";
import { safeSponsoredDestination } from "./rules";

export type EditorialPostInput = {
  channelId: string;
  title: string;
  summary?: string | null;
  imageUrl?: string | null;
  destinationUrl?: string | null;
  expiresAt?: string | null;
};

export function validateEditorialPost(input: EditorialPostInput) {
  const errors: string[] = [];
  if (!input.channelId) errors.push("Canal requis.");
  if (input.title.trim().length < 4) errors.push("Titre trop court.");
  if (input.destinationUrl && !safeSponsoredDestination(input.destinationUrl)) errors.push("URL de destination invalide.");
  if (input.expiresAt && new Date(input.expiresAt).getTime() <= Date.now()) errors.push("Expiration déjà passée.");
  return { valid: errors.length === 0, errors };
}

export async function createEditorialPost(input: EditorialPostInput) {
  if (!channelsEnabled()) return { created: false, errors: ["Canaux désactivés."] };
  const validation = validateEditorialPost(input);
  if (!validation.valid) return { created: false, errors: validation.errors };
  const { data, error } = await serviceDb().from("channel_posts").insert({
    channel_id: input.channelId,
    post_type: "editorial",
    title: input.title.trim(),
    summary: input.summary?.trim() || "",
    image_url: input.imageUrl || null,
    destination_url: input.destinationUrl ? safeSponsoredDestination(input.destinationUrl) : null,
    status: "published",
    published_at: new Date().toISOString(),
    expires_at: input.expiresAt || null
  }).select("id,status").single();
  if (error) throw new Error(`Création publication éditoriale: ${error.message}`);
  return { created: true, post: data, errors: [] as string[] };
}
