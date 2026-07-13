import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  handleUpdate: vi.fn(),
  insert: vi.fn(),
  deleteEq: vi.fn()
}));

vi.mock("@/telegram/bot", () => ({
  createBot: () => ({ handleUpdate: mocks.handleUpdate })
}));

vi.mock("@/lib/db/server", () => ({
  serviceDb: () => ({
    from: (table: string) => {
      if (table !== "processed_updates") throw new Error(`Unexpected table: ${table}`);
      return {
        insert: mocks.insert,
        delete: () => ({ eq: mocks.deleteEq })
      };
    }
  })
}));

vi.mock("@/lib/api", () => ({
  jsonError: (message: string, status = 400, details?: unknown) =>
    Response.json({ error: message, details }, { status })
}));

import { POST } from "@/app/api/telegram/webhook/route";

function telegramRequest(updateId = 123, secret = "test-webhook-secret") {
  return new Request("http://localhost/api/telegram/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": secret
    },
    body: JSON.stringify({ update_id: updateId, message: { text: "/start" } })
  });
}

describe("Telegram webhook idempotency", () => {
  beforeEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "test-webhook-secret";
    mocks.handleUpdate.mockReset();
    mocks.insert.mockReset();
    mocks.deleteEq.mockReset();
    mocks.insert.mockResolvedValue({ error: null });
    mocks.deleteEq.mockResolvedValue({ error: null });
  });

  it("rejects forged webhook requests before accessing the database", async () => {
    const response = await POST(telegramRequest(123, "wrong-secret"));

    expect(response.status).toBe(401);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects oversized webhook requests", async () => {
    const response = await POST(new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": "600000",
        "x-telegram-bot-api-secret-token": "test-webhook-secret"
      },
      body: "{}"
    }));

    expect(response.status).toBe(413);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("releases the update claim when Telegraf fails so Telegram can retry", async () => {
    mocks.handleUpdate.mockRejectedValueOnce(new Error("temporary failure"));

    const response = await POST(telegramRequest(456));

    expect(response.status).toBe(500);
    expect(mocks.deleteEq).toHaveBeenCalledWith("update_id", 456);
  });

  it("does not execute an update already claimed", async () => {
    mocks.insert.mockResolvedValueOnce({ error: { code: "23505" } });

    const response = await POST(telegramRequest(789));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, duplicate: true });
    expect(mocks.handleUpdate).not.toHaveBeenCalled();
  });
});
