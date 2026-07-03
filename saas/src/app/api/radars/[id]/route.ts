import { NextResponse } from "next/server";
import { apiUser, jsonError } from "@/lib/api";
import { serviceDb } from "@/lib/db/server";
import { radarSchema } from "@/lib/validation/radar";
import { enforcePlanLimits } from "@/plans/limits";

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
  const db = serviceDb();
  const { data: existing } = await db
    .from("radars").select("id,is_active,scan_frequency_minutes")
    .eq("id", id).eq("user_id", auth.user.id).maybeSingle();
  if (!existing) return jsonError("Radar introuvable.", 404);
  const nextActive = parsed.data.is_active ?? existing.is_active;
  const requestedScanMinutes =
    parsed.data.scan_frequency_minutes ?? existing.scan_frequency_minutes;
  const [{ count: activeRadars }, { count: alertsToday }] = await Promise.all([
    db.from("radars").select("*", { count: "exact", head: true })
      .eq("user_id", auth.user.id).eq("is_active", true).neq("id", id),
    db.from("alerts").select("*", { count: "exact", head: true })
      .eq("user_id", auth.user.id)
      .gte("created_at", new Date(Date.now() - 86_400_000).toISOString())
  ]);
  const limits = enforcePlanLimits(auth.user, {
    activeRadars: nextActive ? activeRadars ?? 0 : 0,
    alertsToday: alertsToday ?? 0,
    requestedScanMinutes
  });
  if (!limits.allowed) return jsonError(limits.errors.join(" "), 403);
  const { data, error } = await db.from("radars").update(parsed.data).eq("id", id).eq("user_id", auth.user.id).select("*").maybeSingle();
  return error || !data ? jsonError("Radar introuvable.", 404) : NextResponse.json({ radar: data });
}
export async function DELETE(_: Request, { params }: Context) {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  const { id } = await params;
  const { error } = await serviceDb().from("radars").delete().eq("id", id).eq("user_id", auth.user.id);
  return error ? jsonError("Suppression impossible.", 500) : NextResponse.json({ ok: true });
}
