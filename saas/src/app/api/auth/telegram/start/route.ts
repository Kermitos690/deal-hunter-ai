import { NextRequest, NextResponse } from "next/server";
import { returnPathCookieName, safeReturnPath } from "@/lib/security/return-path";
import { telegramStartUrl } from "@/lib/telegram-links";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const returnTo = safeReturnPath(requestUrl.searchParams.get("next"));
  const response = NextResponse.redirect(telegramStartUrl("dashboard"));

  response.cookies.set(returnPathCookieName, returnTo, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60
  });

  return response;
}
