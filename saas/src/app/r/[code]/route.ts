import { NextRequest, NextResponse } from "next/server";
import { normalizeReferralCode, referralCookieName } from "@/lib/referrals/referral-program";
import { telegramStartUrl } from "@/lib/telegram-links";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code: rawCode } = await context.params;
  const code = normalizeReferralCode(rawCode);
  if (!code || process.env.ENABLE_REFERRALS !== "true") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.redirect(telegramStartUrl("dashboard"));
  response.cookies.set(referralCookieName, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
  return response;
}
