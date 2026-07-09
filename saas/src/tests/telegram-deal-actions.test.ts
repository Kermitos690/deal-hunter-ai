import { describe, expect, it } from "vitest";
import { alertStatusForTelegramAction, isTelegramDealAction } from "@/telegram/deal-actions";
import { dealAlertKeyboard } from "@/telegram/send-alert";

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
});
