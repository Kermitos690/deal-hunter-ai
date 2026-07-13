import { describe, expect, it } from "vitest";
import { classifyTelegramFailure } from "@/telegram/send-alert";

describe("Telegram delivery failures", () => {
  it("classifies permanent recipient errors without retrying forever", () => {
    expect(classifyTelegramFailure({ response: { error_code: 403, description: "Forbidden: bot was blocked by the user" } }))
      .toBe("telegram_forbidden");
    expect(classifyTelegramFailure({ response: { error_code: 400, description: "Bad Request: chat not found" } }))
      .toBe("telegram_bad_request");
  });

  it("classifies rate limits and transient API errors", () => {
    expect(classifyTelegramFailure({ response: { error_code: 429, description: "Too Many Requests" } }))
      .toBe("telegram_rate_limited");
    expect(classifyTelegramFailure(new Error("network timeout")))
      .toBe("telegram_api_error");
  });
});
