import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { serviceDb } from "@/lib/db/server";
import { env } from "@/lib/env";
import type { AppUser } from "@/types";

const COOKIE = "deal_hunter_session";

function signature(payload: string) {
  return crypto
    .createHmac("sha256", env().SESSION_SECRET)
    .update(payload)
    .digest("base64url");
}

export function createSessionToken(telegramId: string, ttlSeconds = 60 * 60 * 24 * 30) {
  const payload = Buffer.from(
    JSON.stringify({ telegramId, exp: Math.floor(Date.now() / 1000) + ttlSeconds })
  ).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifySessionToken(token?: string | null): string | null {
  if (!token) return null;
  const [payload, supplied] = token.split(".");
  if (!payload || !supplied) return null;
  const expected = signature(payload);
  if (
    supplied.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  ) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return String(decoded.telegramId);
  } catch {
    return null;
  }
}

export async function currentUser(): Promise<AppUser | null> {
  const cookieStore = await cookies();
  let telegramId = verifySessionToken(cookieStore.get(COOKIE)?.value);
  if (!telegramId && process.env.NODE_ENV !== "production") {
    telegramId = (await headers()).get("x-telegram-id");
  }
  if (!telegramId) return null;
  const { data } = await serviceDb()
    .from("users")
    .select("id,telegram_id,email,display_name,role,plan,alerts_enabled")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  return (data as AppUser | null) ?? null;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin" || user.telegram_id !== process.env.ADMIN_TELEGRAM_ID) {
    redirect("/dashboard");
  }
  return user;
}

export const sessionCookieName = COOKIE;
