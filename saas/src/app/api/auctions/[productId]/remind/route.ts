import { NextResponse } from "next/server";
import { apiUser, jsonError } from "@/lib/api";
import { serviceDb } from "@/lib/db/server";
type Context = { params: Promise<{ productId: string }> };
export async function POST(request: Request, { params }: Context) {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  const productId = (await params).productId;
  await request.json().catch(() => ({}));
  const { data: deal } = await serviceDb()
    .from("deal_scores")
    .select("radar_id,products(auction_end_at)")
    .eq("product_id", productId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  const product = Array.isArray(deal?.products) ? deal.products[0] : deal?.products;
  if (!deal || !product?.auction_end_at) return jsonError("Enchère introuvable pour ce compte.", 404);
  const remindAt = new Date(new Date(product.auction_end_at).getTime() - 3_600_000);
  const { data, error } = await serviceDb().from("auction_reminders").upsert({
    user_id: auth.user.id, product_id: productId, radar_id: deal.radar_id,
    remind_at: remindAt.toISOString(), status: "pending"
  }).select("*").single();
  return error ? jsonError("Rappel impossible.", 500) : NextResponse.json({ reminder: data });
}
