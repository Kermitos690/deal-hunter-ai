import { NextResponse } from "next/server";
import { apiUser, jsonError } from "@/lib/api";
import { serviceDb } from "@/lib/db/server";
type Context = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: Context) {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  const { data: deal } = await serviceDb().from("deal_scores").select("product_id").eq("id", (await params).id).eq("user_id", auth.user.id).maybeSingle();
  if (!deal) return jsonError("Deal introuvable.", 404);
  const { error } = await serviceDb().from("saved_deals").upsert({ user_id: auth.user.id, product_id: deal.product_id });
  return error ? jsonError("Sauvegarde impossible.", 500) : NextResponse.json({ ok: true });
}
