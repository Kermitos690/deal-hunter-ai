import { NextResponse } from "next/server";
import { apiUser, isAdmin, jsonError } from "@/lib/api";
import { serviceDb } from "@/lib/db/server";
import { missingEnvironmentVariables } from "@/lib/env";
import { configuredSources, summarizeSourceLogs } from "@/lib/admin/source-health";

export async function GET() {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  if (!isAdmin(auth.user)) return jsonError("Accès administrateur requis.", 403);
  const db = serviceDb();
  const week = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [{ count: users }, { count: activeUsers }, { count: suspendedUsers }, { count: radars }, { data: lastScan }, { data: sourceLogs }] = await Promise.all([
    db.from("users").select("*", { count: "exact", head: true }),
    db.from("users").select("*", { count: "exact", head: true }).eq("status","active"),
    db.from("users").select("*", { count: "exact", head: true }).eq("status","suspended"),
    db.from("radars").select("*", { count: "exact", head: true }).eq("is_active", true),
    db.from("scan_logs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("source_scan_logs").select("source,status,candidates_found,duration_ms,error_message,started_at,finished_at").gte("started_at",week).order("started_at",{ascending:false}).limit(1000)
  ]);
  return NextResponse.json({
    status: "ok",
    database: "connected",
    telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    cron: Boolean(process.env.CRON_SECRET),
    missingEnvironmentVariables: missingEnvironmentVariables(),
    users, activeUsers, suspendedUsers, activeRadars: radars, lastScan,
    sources: configuredSources(),
    sourceHealth: summarizeSourceLogs(sourceLogs ?? []),
    checkedAt: new Date().toISOString()
  });
}
