import { describe, expect, it } from "vitest";
import { normalizeUpsertOptions } from "@/lib/db/upsert-conflicts";

describe("composite upsert conflict targets", () => {
  it.each(["saved_deals", "rejected_products", "auction_reminders"])(
    "uses the user/product unique key for %s",
    (table) => {
      expect(normalizeUpsertOptions(table)).toEqual({
        onConflict: "user_id,product_id"
      });
    }
  );

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
