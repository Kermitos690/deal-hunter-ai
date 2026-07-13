import { afterEach, describe, expect, it } from "vitest";
import { looksLikeWhatsAppPhone, normalizeWhatsAppPhone, sendWhatsAppText } from "@/whatsapp/client";

const originalEnabled = process.env.ENABLE_WHATSAPP;

describe("WhatsApp client", () => {
  afterEach(() => {
    if (originalEnabled === undefined) delete process.env.ENABLE_WHATSAPP;
    else process.env.ENABLE_WHATSAPP = originalEnabled;
  });

  it("normalise les numéros au format Meta sans signe plus", () => {
    expect(normalizeWhatsAppPhone("+41 79 123 45 67")).toBe("41791234567");
    expect(normalizeWhatsAppPhone("0041 79 123 45 67")).toBe("41791234567");
    expect(looksLikeWhatsAppPhone("+41 79 123 45 67")).toBe(true);
    expect(looksLikeWhatsAppPhone("abc")).toBe(false);
  });

  it("ne contacte jamais Meta quand le canal est désactivé", async () => {
    process.env.ENABLE_WHATSAPP = "false";
    await expect(sendWhatsAppText("41791234567", "test")).resolves.toEqual({
      skipped: true,
      reason: "disabled"
    });
  });
});
