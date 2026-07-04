import { NextResponse } from "next/server";
import { apiUser, jsonError } from "@/lib/api";
import { serviceDb } from "@/lib/db/server";
import { actualProfit, dealLifecycleSchema } from "@/lib/deals/lifecycle";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const auth = await apiUser();
  if ("response" in auth) return auth.response;
  const parsed = dealLifecycleSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Données de suivi invalides.", 422, parsed.error.flatten());

  const { data: deal } = await serviceDb()
    .from("deal_scores")
    .select("product_id")
    .eq("id", (await params).id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!deal) return jsonError("Deal introuvable.", 404);

  const value = parsed.data;
  const now = new Date().toISOString();
  const payload = {
    user_id: auth.user.id,
    product_id: deal.product_id,
    lifecycle_status: value.status,
    actual_buy_price: value.actualBuyPrice ?? null,
    actual_sale_price: value.actualSalePrice ?? null,
    actual_fees: value.actualFees ?? 0,
    actual_profit: actualProfit(value),
    purchased_at: ["purchased", "listed", "sold"].includes(value.status) ? now : null,
    sold_at: value.status === "sold" ? now : null,
    notes: value.notes || null
  };
  const { data, error } = await serviceDb()
    .from("saved_deals")
    .upsert(payload, { onConflict: "user_id,product_id" })
    .select("*")
    .single();
  return error ? jsonError("Suivi impossible.", 500) : NextResponse.json({ savedDeal: data });
}
