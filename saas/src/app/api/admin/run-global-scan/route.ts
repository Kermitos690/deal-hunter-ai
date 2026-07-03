import { NextResponse } from "next/server";
import { apiUser, isAdmin, jsonError } from "@/lib/api";
import { runDueScans } from "@/lib/scans/run-radar-scan";
export async function POST() {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  if (!isAdmin(auth.user)) return jsonError("Accès administrateur requis.", 403);
  return NextResponse.json({ results: await runDueScans() });
}
