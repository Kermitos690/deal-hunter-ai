import { describe, expect, it } from "vitest";
import { alertStatusForTelegramAction, isTelegramDealAction } from "@/telegram/deal-actions";
import { dealAlertKeyboard, dealReviewKeyboard } from "@/telegram/send-alert";

describe("telegram deal actions", () => {
  it("normalise les statuts enregistrés depuis les boutons Telegram", () => {
    expect(alertStatusForTelegramAction("save")).toBe("saved");
    expect(alertStatusForTelegramAction("reject")).toBe("rejected");
    expect(alertStatusForTelegramAction("negotiate")).toBe("negotiating");
    expect(alertStatusForTelegramAction("remind")).toBe("reminder");
  });

  it("rejette les callbacks inconnus", () => {
    expect(isTelegramDealAction("analysis")).toBe(true);
    expect(isTelegramDealAction("delete_everything")).toBe(false);
  });

  it("n’affiche pas le rappel sur une annonce sans fin d’enchère", () => {
    const keyboard = dealAlertKeyboard("alert-1", "https://example.com", false);
    expect(JSON.stringify(keyboard)).not.toContain("remind:alert-1");
    expect(JSON.stringify(keyboard)).toContain("analysis:alert-1");
  });

  it("propose une revue rapide type inbox Tinder", () => {
    const keyboard = dealReviewKeyboard("alert-1", "https://example.com", true);
    const body = JSON.stringify(keyboard);
    expect(body).toContain("reject:alert-1");
    expect(body).toContain("save:alert-1");
    expect(body).toContain("deal_next");
    expect(body).toContain("inbox");
  });
});
