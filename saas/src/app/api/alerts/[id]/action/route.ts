import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser, jsonError } from "@/lib/api";
import { serviceDb } from "@/lib/db/server";
type Context = { params: Promise<{ id: string }> };
const schema = z.object({ action: z.enum(["saved", "rejected", "negotiating", "reminder"]) });

export async function POST(request: Request, { params }: Context) {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Action invalide.", 422);
  const { data, error } = await serviceDb().from("alerts").update({ status: parsed.data.action }).eq("id", (await params).id).eq("user_id", auth.user.id).select("*").maybeSingle();
  return error || !data ? jsonError("Alerte introuvable.", 404) : NextResponse.json({ alert: data });
}
