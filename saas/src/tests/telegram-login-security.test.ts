import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyTelegramLogin, type TelegramLoginPayload } from "@/lib/security/telegram-login";

function signedPayload(token: string): TelegramLoginPayload {
  const payload: Record<string, string> = {
    id: "123456",
    auth_date: String(Math.floor(Date.now() / 1000)),
    first_name: "Beta"
  };
  const checkString = Object.entries(payload)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = crypto.createHash("sha256").update(token).digest();
  const hash = crypto.createHmac("sha256", secret).update(checkString).digest("hex");
  return { ...payload, hash } as TelegramLoginPayload;
}

describe("Telegram login security", () => {
  it("accepte une signature Telegram valide", () => {
    expect(verifyTelegramLogin(signedPayload("bot-token-test"), "bot-token-test")).toBe(true);
  });

  it("refuse un hash malformé sans lever d'exception", () => {
    const payload = {
      id: "123",
      auth_date: String(Math.floor(Date.now() / 1000)),
      hash: "x"
    } as TelegramLoginPayload;
    expect(() => verifyTelegramLogin(payload, "bot-token-test")).not.toThrow();
    expect(verifyTelegramLogin(payload, "bot-token-test")).toBe(false);
  });

  it("refuse une authentification expirée", () => {
    const payload = signedPayload("bot-token-test");
    payload.auth_date = String(Math.floor(Date.now() / 1000) - 90_000);
    expect(verifyTelegramLogin(payload, "bot-token-test")).toBe(false);
  });
});
