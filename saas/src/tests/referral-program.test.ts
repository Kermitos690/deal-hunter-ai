import { describe, expect, it } from "vitest";
import {
  effectivePlanForUser,
  monthlyReferralCreditAmount,
  normalizeReferralCode,
  referralAccessIsActive,
  referralProgress,
  referralStartPayload
} from "@/lib/referrals/referral-program";
import { enforcePlanLimits } from "@/plans/limits";

describe("referral programme", () => {
  it("normalise uniquement les codes sûrs", () => {
    expect(normalizeReferralCode("ref_dh123abc")).toBe("DH123ABC");
    expect(normalizeReferralCode(" ref-DH999999 ")).toBe("DH999999");
    expect(normalizeReferralCode("../../secret")).toBeNull();
    expect(referralStartPayload("DH123ABC")).toBe("ref_DH123ABC");
  });

  it("convertit les mois gagnés en progression annuelle", () => {
    expect(referralProgress(0)).toEqual({
      monthsEarned: 0,
      fullYearsEarned: 0,
      monthsTowardNextYear: 0,
      referralsUntilNextFreeYear: 12
    });
    expect(referralProgress(11).referralsUntilNextFreeYear).toBe(1);
    expect(referralProgress(12)).toEqual({
      monthsEarned: 12,
      fullYearsEarned: 1,
      monthsTowardNextYear: 0,
      referralsUntilNextFreeYear: 12
    });
    expect(referralProgress(25).monthsTowardNextYear).toBe(1);
  });

  it("accorde temporairement les limites Pro à un compte Free récompensé", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(referralAccessIsActive({ referral_access_until: future })).toBe(true);
    expect(effectivePlanForUser({ plan: "free", referral_access_until: future })).toBe("pro");
    expect(enforcePlanLimits(
      { plan: "free", referral_access_until: future },
      { activeRadars: 2, alertsToday: 0 }
    ).allowed).toBe(true);
  });

  it("revient aux limites Free après expiration", () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(effectivePlanForUser({ plan: "free", referral_access_until: past })).toBe("free");
    expect(enforcePlanLimits(
      { plan: "free", referral_access_until: past },
      { activeRadars: 2, alertsToday: 0 }
    ).allowed).toBe(false);
  });

  it("calcule un mois de crédit pour les tarifs mensuels et annuels", () => {
    expect(monthlyReferralCreditAmount({ unitAmount: 1900, interval: "month", intervalCount: 1 })).toBe(1900);
    expect(monthlyReferralCreditAmount({ unitAmount: 22800, interval: "year", intervalCount: 1 })).toBe(1900);
    expect(monthlyReferralCreditAmount({ unitAmount: 0, interval: "month" })).toBe(0);
  });
});
