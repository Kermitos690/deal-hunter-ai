import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/db/server";
import { createSessionToken, sessionCookieName } from "@/lib/security/session";
import { verifyTelegramLogin, type TelegramLoginPayload } from "@/lib/security/telegram-login";
import { jsonError } from "@/lib/api";

export async function POST(request: Request) {
  const payload = (await request.json()) as TelegramLoginPayload;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !verifyTelegramLogin(payload, token)) {
    return jsonError("Signature Telegram invalide.", 401);
  }
  const telegramId = String(payload.id);
  const { data, error } = await serviceDb()
    .from("users")
    .upsert({
      telegram_id: telegramId,
      display_name: [payload.first_name, payload.last_name].filter(Boolean).join(" ") || payload.username || "Deal Hunter",
      role: telegramId === process.env.ADMIN_TELEGRAM_ID ? "admin" : "user"
    }, { onConflict: "telegram_id" })
    .select("*")
    .single();
  if (error) return jsonError("Création du compte impossible.", 500);
  const response = NextResponse.json({ user: data });
  response.cookies.set(sessionCookieName, createSessionToken(telegramId), {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30
  });
  return response;
}
