import { effectivePlanForUser } from "@/lib/referrals/referral-program";
import type { AppUser, Plan } from "@/types";

export const PLAN_LIMITS: Record<
  Plan,
  { activeRadars: number; alertsPerDay: number; minScanMinutes: number; historyDays: number }
> = {
  free: { activeRadars: 2, alertsPerDay: 10, minScanMinutes: 360, historyDays: 7 },
  pro: { activeRadars: 20, alertsPerDay: 200, minScanMinutes: 30, historyDays: 90 },
  business: {
    activeRadars: Number.MAX_SAFE_INTEGER,
    alertsPerDay: Number.MAX_SAFE_INTEGER,
    minScanMinutes: 30,
    historyDays: 365
  }
};

export function enforcePlanLimits(
  user: Pick<AppUser, "plan" | "referral_access_until">,
  usage: { activeRadars: number; alertsToday: number; requestedScanMinutes?: number }
) {
  const plan = effectivePlanForUser(user);
  const limits = PLAN_LIMITS[plan];
  const errors: string[] = [];
  if (usage.activeRadars >= limits.activeRadars) errors.push("Limite de radars actifs atteinte.");
  if (usage.alertsToday >= limits.alertsPerDay) errors.push("Quota quotidien d’alertes atteint.");
  if (
    usage.requestedScanMinutes &&
    usage.requestedScanMinutes < limits.minScanMinutes
  ) errors.push(`Fréquence minimale du plan : ${limits.minScanMinutes} minutes.`);
  return { allowed: errors.length === 0, errors, limits, plan };
}
