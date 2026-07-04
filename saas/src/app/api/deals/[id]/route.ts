import { NextResponse } from "next/server";
import { apiUser, jsonError } from "@/lib/api";
import { serviceDb } from "@/lib/db/server";
type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Context) {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  const { data } = await serviceDb()
    .from("deal_scores")
    .select("*, products(*, product_images(*)), radars(*), deal_score_comparables(*)")
    .eq("id", (await params).id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  return data ? NextResponse.json({ deal: data }) : jsonError("Deal introuvable.", 404);
}
