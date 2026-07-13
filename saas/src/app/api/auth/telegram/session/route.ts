import { NextRequest, NextResponse } from "next/server";
import { serviceDb } from "@/lib/db/server";
import {
  createSessionToken,
  sessionCookieName,
  verifySessionToken
} from "@/lib/security/session";
import { claimReferralCode } from "@/lib/referrals/server";
import { referralCookieName } from "@/lib/referrals/referral-program";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const telegramId = verifySessionToken(url.searchParams.get("token"));
  if (!telegramId) return NextResponse.redirect(new URL("/login?error=expired", url));

  const { data: user } = await serviceDb()
    .from("users")
    .select("id")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  if (!user) return NextResponse.redirect(new URL("/login?error=missing", url));

  const storedReferralCode = request.cookies.get(referralCookieName)?.value;
  if (process.env.ENABLE_REFERRALS === "true" && storedReferralCode) {
    try {
      await claimReferralCode(user.id, storedReferralCode);
    } catch (error) {
      console.error("Stored referral claim failed:", error instanceof Error ? error.message : "unknown");
    }
  }

  const response = NextResponse.redirect(new URL("/dashboard", url));
  response.cookies.set(sessionCookieName, createSessionToken(telegramId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
  response.cookies.delete(referralCookieName);
  return response;
}
