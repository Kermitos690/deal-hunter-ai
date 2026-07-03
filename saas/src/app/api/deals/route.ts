import { NextResponse } from "next/server";
import { apiUser, jsonError } from "@/lib/api";
import { serviceDb } from "@/lib/db/server";
import { PLAN_LIMITS } from "@/plans/limits";

export async function GET(request: Request) {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(100, requestedLimit)) : 50;
  const since = new Date(
    Date.now() - PLAN_LIMITS[auth.user.plan].historyDays * 86_400_000
  ).toISOString();
  const { data, error } = await serviceDb()
    .from("deal_scores")
    .select("*, products(*, product_images(*)), radars(name)")
    .eq("user_id", auth.user.id)
    .gte("created_at", since)
    .order("total_score", { ascending: false })
    .limit(limit);
  return error ? jsonError("Lecture des deals impossible.", 500) : NextResponse.json({ deals: data });
}
