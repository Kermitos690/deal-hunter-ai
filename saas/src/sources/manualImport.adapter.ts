import { z } from "zod";
import type { ProductCandidate } from "@/types";

export const manualCandidateSchema = z.object({
  source: z.string().default("manual"),
  sourceItemId: z.string().optional(),
  title: z.string().min(3),
  price: z.coerce.number().positive(),
  currency: z.string().length(3).default("CHF"),
  url: z.string().url(),
  imageUrls: z.array(z.string().url()).default([]),
  description: z.string().optional(),
  condition: z.enum(["NEW", "A", "B", "C", "REPAIR", "UNKNOWN"]).default("UNKNOWN"),
  auctionEndAt: z.string().datetime().optional()
});

export function manualToCandidate(input: unknown): ProductCandidate {
  const value = manualCandidateSchema.parse(input);
  return {
    source: value.source,
    sourceItemId: value.sourceItemId ?? Buffer.from(value.url).toString("base64url").slice(0, 40),
    title: value.title,
    priceAmount: value.price,
    priceCurrency: value.currency.toUpperCase(),
    productUrl: value.url,
    imageUrls: value.imageUrls,
    description: value.description,
    conditionGrade: value.condition,
    auctionEndAt: value.auctionEndAt,
    rawPayload: { imported: true }
  };
}
