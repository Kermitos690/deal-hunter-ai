import type { AppUser, Plan } from "@/types";

const REFERRAL_CODE = /^[A-Z0-9]{6,32}$/;

export function normalizeReferralCode(value?: string | null) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/^ref[_-]?/i, "")
    .toUpperCase();
  return REFERRAL_CODE.test(normalized) ? normalized : null;
}

export function referralStartPayload(code: string) {
  const normalized = normalizeReferralCode(code);
  if (!normalized) throw new Error("Code de parrainage invalide.");
  return `ref_${normalized}`;
}

export function referralBotUrl(code: string, botUsername = process.env.TELEGRAM_BOT_USERNAME ?? "deal_hunter_cards_bot") {
  return `https://t.me/${botUsername.replace(/^@/, "")}?start=${encodeURIComponent(referralStartPayload(code))}`;
}

export function referralAccessIsActive(user: Pick<AppUser, "referral_access_until">, now = new Date()) {
  if (!user.referral_access_until) return false;
  const until = new Date(user.referral_access_until);
  return Number.isFinite(until.getTime()) && until.getTime() > now.getTime();
}

export function effectivePlanForUser(
  user: Pick<AppUser, "plan" | "referral_access_until">,
  now = new Date()
): Plan {
  if (user.plan !== "free") return user.plan;
  return referralAccessIsActive(user, now) ? "pro" : "free";
}

export function monthlyReferralCreditAmount(input: {
  unitAmount: number | null | undefined;
  interval?: "day" | "week" | "month" | "year" | null;
  intervalCount?: number | null;
}) {
  const unitAmount = Math.max(0, Math.trunc(input.unitAmount ?? 0));
  const intervalCount = Math.max(1, Math.trunc(input.intervalCount ?? 1));
  if (!unitAmount) return 0;
  if (input.interval === "year") return Math.max(1, Math.round(unitAmount / (12 * intervalCount)));
  if (input.interval === "week") return Math.max(1, Math.round(unitAmount * (52 / 12) / intervalCount));
  if (input.interval === "day") return Math.max(1, Math.round(unitAmount * (365 / 12) / intervalCount));
  return Math.max(1, Math.round(unitAmount / intervalCount));
}

export function referralProgress(monthsEarned: number) {
  const earned = Math.max(0, Math.trunc(monthsEarned));
  return {
    monthsEarned: earned,
    fullYearsEarned: Math.floor(earned / 12),
    monthsTowardNextYear: earned % 12,
    referralsUntilNextFreeYear: 12 - (earned % 12 || 12)
  };
}
