import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWhatsAppSignature } from "@/whatsapp/webhook-security";

describe("WhatsApp webhook signature", () => {
  it("accepts a valid Meta HMAC signature", () => {
    const body = JSON.stringify({ object: "whatsapp_business_account" });
    const secret = "test-app-secret";
    const signature = `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;

    expect(verifyWhatsAppSignature(body, signature, secret)).toBe(true);
  });

  it("rejects missing, malformed or forged signatures", () => {
    const body = "{}";
    expect(verifyWhatsAppSignature(body, null, "secret")).toBe(false);
    expect(verifyWhatsAppSignature(body, "sha1=bad", "secret")).toBe(false);
    expect(verifyWhatsAppSignature(body, `sha256=${"0".repeat(64)}`, "secret")).toBe(false);
  });
});
