import { NextResponse } from "next/server";
import { apiUser, jsonError } from "@/lib/api";
import { serviceDb } from "@/lib/db/server";
import { radarSchema } from "@/lib/validation/radar";

type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: Context) {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  const { id } = await params;
  const { data } = await serviceDb().from("radars").select("*, scan_logs(*), alerts(*)").eq("id", id).eq("user_id", auth.user.id).maybeSingle();
  return data ? NextResponse.json({ radar: data }) : jsonError("Radar introuvable.", 404);
}
export async function PATCH(request: Request, { params }: Context) {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  const { id } = await params;
  const parsed = radarSchema.partial().safeParse(await request.json());
  if (!parsed.success) return jsonError("Modification invalide.", 422, parsed.error.flatten());
  const { data, error } = await serviceDb().from("radars").update(parsed.data).eq("id", id).eq("user_id", auth.user.id).select("*").maybeSingle();
  return error || !data ? jsonError("Radar introuvable.", 404) : NextResponse.json({ radar: data });
}
export async function DELETE(_: Request, { params }: Context) {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  const { id } = await params;
  const { error } = await serviceDb().from("radars").delete().eq("id", id).eq("user_id", auth.user.id);
  return error ? jsonError("Suppression impossible.", 500) : NextResponse.json({ ok: true });
}
