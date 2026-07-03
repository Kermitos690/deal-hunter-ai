import { NextResponse } from "next/server";
import { apiUser, jsonError } from "@/lib/api";
import { serviceDb } from "@/lib/db/server";
import { radarSchema } from "@/lib/validation/radar";
import { enforcePlanLimits } from "@/plans/limits";

export async function GET() {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  const { data, error } = await serviceDb().from("radars").select("*").eq("user_id", auth.user.id).order("created_at", { ascending: false });
  return error ? jsonError("Lecture des radars impossible.", 500) : NextResponse.json({ radars: data });
}

export async function POST(request: Request) {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  const parsed = radarSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Radar invalide.", 422, parsed.error.flatten());
  const [{ count: activeRadars }, { count: alertsToday }] = await Promise.all([
    serviceDb().from("radars").select("*", { count: "exact", head: true }).eq("user_id", auth.user.id).eq("is_active", true),
    serviceDb().from("alerts").select("*", { count: "exact", head: true }).eq("user_id", auth.user.id).gte("created_at", new Date(Date.now() - 86400000).toISOString())
  ]);
  const limits = enforcePlanLimits(auth.user, { activeRadars: activeRadars ?? 0, alertsToday: alertsToday ?? 0, requestedScanMinutes: parsed.data.scan_frequency_minutes });
  if (!limits.allowed) return jsonError(limits.errors.join(" "), 403);
  const { data, error } = await serviceDb().from("radars").insert({ ...parsed.data, user_id: auth.user.id, next_scan_at: new Date().toISOString() }).select("*").single();
  return error ? jsonError("Création impossible.", 500) : NextResponse.json({ radar: data }, { status: 201 });
}
