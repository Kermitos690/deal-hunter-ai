import { NextResponse } from "next/server";
import { currentUser } from "@/lib/security/session";

export const jsonError = (message: string, status = 400, details?: unknown) =>
  NextResponse.json({ error: message, details }, { status });

export async function apiUser() {
  const user = await currentUser();
  return user ? { user } : { response: jsonError("Authentification requise.", 401) };
}

export function isAdmin(user: { role: string; telegram_id: string | null }) {
  return user.role === "admin" && user.telegram_id === process.env.ADMIN_TELEGRAM_ID;
}
