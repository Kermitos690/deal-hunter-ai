import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, isAdmin, jsonError } from "@/lib/api";
import { serviceDb } from "@/lib/db/server";
import { runRadarScan } from "@/lib/scans/run-radar-scan";
import { rateLimit } from "@/lib/security/rate-limit";

const radarIdSchema = z.string().uuid();

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await apiUser();
  if ("response" in auth) return auth.response;
  if (!isAdmin(auth.user)) return jsonError("Accès administrateur requis.", 403);
  if (!await rateLimit(`admin-radar-scan:${auth.user.id}`, 10, 300)) {
    return jsonError("Trop de scans administrateur rapprochés.", 429);
  }

  const { id } = await context.params;
  const parsedId = radarIdSchema.safeParse(id);
  if (!parsedId.success) return jsonError("Identifiant radar invalide.", 422);

  const { data: radar, error } = await serviceDb()
    .from("radars")
    .select("id,user_id,name,is_active")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (error) return jsonError("Impossible de lire le radar.", 500);
  if (!radar) return jsonError("Radar introuvable.", 404);
  if (!radar.is_active) return jsonError("Le radar est en pause.", 409);

  try {
    const result = await runRadarScan(radar.id, radar.user_id);
    return NextResponse.json({ radar: { id: radar.id, name: radar.name }, result });
  } catch (scanError) {
    console.error("Admin radar scan failed:", scanError instanceof Error ? scanError.message : "unknown");
    return jsonError("Le scan administrateur a échoué.", 500);
  }
}
