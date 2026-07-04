import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, isAdmin, jsonError } from "@/lib/api";
import { serviceDb } from "@/lib/db/server";

type Context = { params: Promise<{ id: string }> };
const schema = z.object({
  plan: z.enum(["free", "pro", "business"]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  alerts_enabled: z.boolean().optional(),
  admin_notes: z.string().trim().max(1000).nullable().optional()
}).refine((value) => Object.keys(value).length > 0, "Aucune modification.");

export async function PATCH(request: Request, { params }: Context) {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  if (!isAdmin(auth.user)) return jsonError("Accès administrateur requis.", 403);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Modification invalide.", 422, parsed.error.flatten());

  const { id } = await params;
  const { data: target } = await serviceDb()
    .from("users")
    .select("id,telegram_id,display_name,plan,status,alerts_enabled")
    .eq("id", id)
    .maybeSingle();
  if (!target) return jsonError("Utilisateur introuvable.", 404);
  if (
    target.telegram_id === process.env.ADMIN_TELEGRAM_ID &&
    parsed.data.status === "suspended"
  ) return jsonError("Le compte administrateur principal ne peut pas être suspendu.", 409);

  const { data, error } = await serviceDb()
    .from("users")
    .update(parsed.data)
    .eq("id", id)
    .select("id,telegram_id,display_name,email,role,plan,status,alerts_enabled,stripe_customer_id")
    .single();
  if (error) return jsonError("Mise à jour impossible.", 500);

  if (parsed.data.status === "suspended") {
    await serviceDb()
      .from("auction_reminders")
      .update({ status: "cancelled_user_suspended" })
      .eq("user_id", id)
      .eq("status", "pending");
  }

  await serviceDb().from("admin_logs").insert({
    actor_user_id: auth.user.id,
    action: "user.updated",
    payload: {
      target_user_id: id,
      previous: {
        plan: target.plan,
        status: target.status,
        alerts_enabled: target.alerts_enabled
      },
      changes: parsed.data
    }
  });
  return NextResponse.json({ user: data });
}
