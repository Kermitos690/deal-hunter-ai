import { describe, expect, it } from "vitest";
import { mainMenuKeyboard, mainMenuText } from "@/telegram/menu";

describe("telegram menu", () => {
  it("affiche un menu principal compréhensible", () => {
    expect(mainMenuText("Keyan")).toContain("Menu Deal Hunter AI");
    expect(mainMenuText("Keyan")).toContain("Compte : Keyan");
  });

  it("contient les boutons principaux", () => {
    const keyboard = mainMenuKeyboard("https://deal-hunter-ai.vercel.app/dashboard");
    const serialized = JSON.stringify(keyboard);

    expect(serialized).toContain("create_radar");
    expect(serialized).toContain("list_radars");
    expect(serialized).toContain("list_alerts");
    expect(serialized).toContain("list_deals");
    expect(serialized).toContain("https://deal-hunter-ai.vercel.app/dashboard");
  });

  it("supporte les langues principales du bot", () => {
    expect(mainMenuText("Keyan", "en")).toContain("Account : Keyan");
    expect(JSON.stringify(mainMenuKeyboard("https://deal-hunter-ai.vercel.app/dashboard", "de"))).toContain("Radar erstellen");
    expect(JSON.stringify(mainMenuKeyboard("https://deal-hunter-ai.vercel.app/dashboard", "it"))).toContain("Crea radar");
  });
});
