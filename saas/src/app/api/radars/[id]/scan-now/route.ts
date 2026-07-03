import { NextResponse } from "next/server";
import { apiUser, isAdmin, jsonError } from "@/lib/api";
import { runRadarScan } from "@/lib/scans/run-radar-scan";
import { serviceDb } from "@/lib/db/server";
import { PLAN_LIMITS } from "@/plans/limits";
import { rateLimit } from "@/lib/security/rate-limit";

type Context = { params: Promise<{ id: string }> };
export async function POST(_: Request, { params }: Context) {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  if (!await rateLimit(`scan-now:${auth.user.id}`, 5, 60)) {
    return jsonError("Trop de scans manuels. Réessaie dans une minute.", 429);
  }
  const radarId = (await params).id;
  const { data: radar } = await serviceDb()
    .from("radars")
    .select("last_scanned_at")
    .eq("id", radarId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!radar) return jsonError("Radar introuvable.", 404);
  if (!isAdmin(auth.user) && radar.last_scanned_at) {
    const waitMs = PLAN_LIMITS[auth.user.plan].minScanMinutes * 60_000;
    if (Date.now() - new Date(radar.last_scanned_at).getTime() < waitMs) {
      return jsonError("Ce radar a été scanné trop récemment pour ton plan.", 429);
    }
  }
  try {
    return NextResponse.json(await runRadarScan(radarId, auth.user.id));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Scan impossible.", 400);
  }
}
