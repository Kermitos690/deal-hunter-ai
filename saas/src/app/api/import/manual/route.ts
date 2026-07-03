import { NextResponse } from "next/server";
import { apiUser, jsonError } from "@/lib/api";
import { serviceDb } from "@/lib/db/server";
import { manualToCandidate } from "@/sources/manualImport.adapter";
import { estimateMarketValue } from "@/market/market-estimator";
import { calculateDealScore } from "@/scoring/calculate-deal-score";

export async function POST(request: Request) {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  try {
    const body = await request.json();
    const candidate = manualToCandidate(body.candidate);
    const { data: radar } = await serviceDb().from("radars").select("*").eq("id", body.radarId).eq("user_id", auth.user.id).maybeSingle();
    if (!radar) return jsonError("Radar introuvable.", 404);
    const market = estimateMarketValue(candidate, radar);
    const score = calculateDealScore(candidate, radar, market);
    return NextResponse.json({ candidate, market, score });
  } catch (error) {
    return jsonError("Import manuel invalide.", 422, error instanceof Error ? error.message : error);
  }
}
