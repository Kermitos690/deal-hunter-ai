import { describe, expect, it } from "vitest";
import {
  normalizeUpsertOptions,
  USER_PRODUCT_CONFLICT_TARGET
} from "@/lib/db/upsert-conflicts";

describe("composite upsert conflict targets", () => {
  it.each(["saved_deals", "rejected_products", "auction_reminders"])(
    "uses the user/product unique key for repeated writes to %s",
    (table) => {
      expect(normalizeUpsertOptions(table)).toEqual({
        onConflict: USER_PRODUCT_CONFLICT_TARGET
      });
    }
  );

  it("keeps a second Telegram reject idempotent", () => {
    const firstReject = normalizeUpsertOptions("rejected_products");
    const secondReject = normalizeUpsertOptions("rejected_products");

    expect(firstReject).toEqual(secondReject);
    expect(secondReject.onConflict).toBe("user_id,product_id");
  });

  it("preserves an explicit conflict target", () => {
    expect(
      normalizeUpsertOptions("rejected_products", {
        onConflict: "id",
        ignoreDuplicates: true
      })
    ).toEqual({
      onConflict: "id",
      ignoreDuplicates: true
    });
  });

  it("does not modify unrelated tables", () => {
    expect(normalizeUpsertOptions("users", { onConflict: "telegram_id" })).toEqual({
      onConflict: "telegram_id"
    });
  });
});
