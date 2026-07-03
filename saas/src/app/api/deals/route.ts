import { NextResponse } from "next/server";
import { apiUser, jsonError } from "@/lib/api";
import { serviceDb } from "@/lib/db/server";

export async function GET(request: Request) {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  const url = new URL(request.url);
  const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 50));
  const { data, error } = await serviceDb()
    .from("deal_scores")
    .select("*, products(*, product_images(*)), radars(name)")
    .eq("user_id", auth.user.id)
    .order("total_score", { ascending: false })
    .limit(limit);
  return error ? jsonError("Lecture des deals impossible.", 500) : NextResponse.json({ deals: data });
}
