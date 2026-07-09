import { describe, expect, it } from "vitest";
import { looksLikeWhatsAppPhone, normalizeWhatsAppPhone } from "@/whatsapp/client";

describe("WhatsApp client", () => {
  it("normalise les numéros au format Meta sans signe plus", () => {
    expect(normalizeWhatsAppPhone("+41 79 123 45 67")).toBe("41791234567");
    expect(normalizeWhatsAppPhone("0041 79 123 45 67")).toBe("41791234567");
    expect(looksLikeWhatsAppPhone("+41 79 123 45 67")).toBe(true);
    expect(looksLikeWhatsAppPhone("abc")).toBe(false);
  });
});
