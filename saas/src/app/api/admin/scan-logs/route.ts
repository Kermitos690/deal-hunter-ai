import { NextResponse } from "next/server";
import { apiUser, isAdmin, jsonError } from "@/lib/api";
import { serviceDb } from "@/lib/db/server";
export async function GET() {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  if (!isAdmin(auth.user)) return jsonError("Accès administrateur requis.", 403);
  const { data, error } = await serviceDb().from("scan_logs").select("*, radars(name), users(display_name)").order("started_at", { ascending: false }).limit(200);
  return error ? jsonError("Lecture impossible.", 500) : NextResponse.json({ logs: data });
}
