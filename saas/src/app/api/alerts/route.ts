import { NextResponse } from "next/server";
import { apiUser, jsonError } from "@/lib/api";
import { serviceDb } from "@/lib/db/server";

export async function GET() {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  const { data, error } = await serviceDb().from("alerts").select("*, products(*), radars(name), deal_scores(*)").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(100);
  return error ? jsonError("Lecture des alertes impossible.", 500) : NextResponse.json({ alerts: data });
}
