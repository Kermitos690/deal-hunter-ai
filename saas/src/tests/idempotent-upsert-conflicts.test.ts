import { describe, expect, it } from "vitest";
import { conflictTargetForTable, withDefaultUpsertConflict } from "@/lib/db/upsert-conflicts";

describe("idempotent upsert conflict targets", () => {
  it("uses the business unique keys for repeated deal actions", () => {
    expect(conflictTargetForTable("saved_deals")).toBe("user_id,product_id");
    expect(conflictTargetForTable("rejected_products")).toBe("user_id,product_id");
    expect(conflictTargetForTable("auction_reminders")).toBe("user_id,product_id");
  });

  it("does not alter unrelated tables", () => {
    expect(conflictTargetForTable("alerts")).toBeNull();
    expect(withDefaultUpsertConflict("alerts", undefined)).toEqual({});
  });

  it("preserves an explicit conflict target", () => {
    expect(withDefaultUpsertConflict("rejected_products", { onConflict: "id", count: "exact" })).toEqual({
      onConflict: "id",
      count: "exact"
    });
  });
});
