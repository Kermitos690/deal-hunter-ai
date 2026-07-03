import { NextResponse } from "next/server";
import { apiUser, isAdmin, jsonError } from "@/lib/api";
import { serviceDb } from "@/lib/db/server";
import { missingEnvironmentVariables } from "@/lib/env";

export async function GET() {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  if (!isAdmin(auth.user)) return jsonError("Accès administrateur requis.", 403);
  const db = serviceDb();
  const [{ count: users }, { count: radars }, { data: lastScan }] = await Promise.all([
    db.from("users").select("*", { count: "exact", head: true }),
    db.from("radars").select("*", { count: "exact", head: true }).eq("is_active", true),
    db.from("scan_logs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle()
  ]);
  return NextResponse.json({
    status: "ok",
    database: "connected",
    telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    cron: Boolean(process.env.CRON_SECRET),
    missingEnvironmentVariables: missingEnvironmentVariables(),
    users, activeRadars: radars, lastScan,
    checkedAt: new Date().toISOString()
  });
}
