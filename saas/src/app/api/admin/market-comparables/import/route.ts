import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, isAdmin, jsonError } from "@/lib/api";
import { serviceDb } from "@/lib/db/server";
import { normalizeMarketText, normalizeReference } from "@/market/normalize-comparable";

const comparable = z.object({
  source: z.string().trim().min(2).max(80),
  externalId: z.string().trim().min(1).max(200),
  title: z.string().trim().min(3).max(500),
  brand: z.string().trim().max(100).nullable().optional(),
  model: z.string().trim().max(160).nullable().optional(),
  reference: z.string().trim().max(160).nullable().optional(),
  category: z.string().trim().min(2).max(100),
  conditionGrade: z.enum(["NEW", "A", "B", "C", "REPAIR", "UNKNOWN"]).default("UNKNOWN"),
  soldPrice: z.coerce.number().positive(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  soldAt: z.string().datetime(),
  evidenceUrl: z.string().url(),
  country: z.string().trim().length(2).transform((value) => value.toUpperCase()).nullable().optional(),
  fees: z.coerce.number().min(0).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  matchScore: z.coerce.number().min(0.2).max(1).default(0.75),
  rawPayload: z.record(z.unknown()).default({})
});
const bodySchema = z.object({ comparables: z.array(comparable).min(1).max(1000) });

export async function POST(request: Request) {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  if (!isAdmin(auth.user)) return jsonError("Accès administrateur requis.", 403);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Import invalide.", 422, parsed.error.flatten());

  const rows = parsed.data.comparables.map((item) => ({
    source: item.source.toLowerCase(),
    external_id: item.externalId,
    title: normalizeMarketText(item.title),
    brand: normalizeMarketText(item.brand),
    model: normalizeMarketText(item.model),
    reference: normalizeReference(item.reference),
    category: item.category,
    condition_grade: item.conditionGrade,
    sold_price: item.soldPrice,
    currency: item.currency,
    sold_at: item.soldAt,
    evidence_url: item.evidenceUrl,
    country: item.country ?? null,
    fees: item.fees ?? null,
    notes: item.notes ?? null,
    evidence_type: "SOLD",
    confidence: item.confidence,
    match_score: item.matchScore,
    fetched_at: new Date().toISOString(),
    raw_payload: item.rawPayload
  }));
  const { data, error } = await serviceDb()
    .from("market_comparables")
    .upsert(rows, { onConflict: "source,external_id" })
    .select("id");
  if (error) return jsonError("Import impossible.", 500);

  await serviceDb().from("admin_logs").insert({
    actor_user_id: auth.user.id,
    action: "market_comparables.imported",
    payload: { count: data?.length ?? 0, sources: [...new Set(rows.map((row) => row.source))] }
  });
  return NextResponse.json({ imported: data?.length ?? 0 });
}
