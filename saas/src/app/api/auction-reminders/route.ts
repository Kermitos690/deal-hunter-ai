import { NextResponse } from "next/server";
import { apiUser, jsonError } from "@/lib/api";
import { serviceDb } from "@/lib/db/server";
export async function GET() {
  const auth = await apiUser(); if ("response" in auth) return auth.response;
  const { data, error } = await serviceDb().from("auction_reminders").select("*, products(*)").eq("user_id", auth.user.id).order("remind_at");
  return error ? jsonError("Lecture impossible.", 500) : NextResponse.json({ reminders: data });
}
