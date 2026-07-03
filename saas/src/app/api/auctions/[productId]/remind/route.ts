import { NextResponse } from "next/server";
import { apiUser, jsonError } from "@/lib/api";
import { serviceDb } from "@/lib/db/server";
type Context = { params: Promise<{ productId: string }> };
export async function POST(request: Request, { params }: Context) {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  const productId = (await params).productId;
  const body = await request.json();
  const { data: product } = await serviceDb().from("products").select("auction_end_at").eq("id", productId).maybeSingle();
  if (!product?.auction_end_at) return jsonError("Ce produit n’est pas une enchère.", 400);
  const remindAt = new Date(new Date(product.auction_end_at).getTime() - 3_600_000);
  const { data, error } = await serviceDb().from("auction_reminders").upsert({
    user_id: auth.user.id, product_id: productId, radar_id: body.radarId,
    remind_at: remindAt.toISOString(), status: "pending"
  }).select("*").single();
  return error ? jsonError("Rappel impossible.", 500) : NextResponse.json({ reminder: data });
}
