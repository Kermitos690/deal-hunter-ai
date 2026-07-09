import { describe, expect, it } from "vitest";
import { telegramBotUsername, telegramStartUrl } from "@/lib/telegram-links";

describe("telegram links", () => {
  it("construit des liens de démarrage Telegram stables", () => {
    expect(telegramBotUsername()).toBeTruthy();
    expect(telegramStartUrl("newradar")).toContain("?start=newradar");
  });
});
