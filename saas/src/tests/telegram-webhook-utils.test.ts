import { describe, expect, it } from "vitest";
import { classifyTelegramWebhookPayload } from "@/telegram/webhook-utils";

describe("telegram webhook payload", () => {
  it("refuse un payload vide ou invalide", () => {
    expect(classifyTelegramWebhookPayload(null)).toMatchObject({ ok: false, status: 400 });
    expect(classifyTelegramWebhookPayload("bad")).toMatchObject({ ok: false, status: 400 });
  });

  it("refuse un update sans update_id valide", () => {
    expect(classifyTelegramWebhookPayload({ message: {} })).toMatchObject({ ok: false, status: 400 });
  });

  it("ignore proprement un update valide sans message ni callback", () => {
    expect(classifyTelegramWebhookPayload({ update_id: 123 })).toMatchObject({ ok: true, updateId: 123, ignored: true });
  });

  it("accepte message et callback_query", () => {
    expect(classifyTelegramWebhookPayload({ update_id: 124, message: { text: "/menu" } })).toMatchObject({ ok: true, ignored: false });
    expect(classifyTelegramWebhookPayload({ update_id: 125, callback_query: { data: "list_radars" } })).toMatchObject({ ok: true, ignored: false });
  });
});
