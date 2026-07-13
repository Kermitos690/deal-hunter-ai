import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  upsert: vi.fn()
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: (table: string) => {
      mocks.from(table);
      return { upsert: mocks.upsert };
    }
  }))
}));

vi.mock("@/lib/env", () => ({
  env: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key"
  })
}));

import { serviceDb } from "@/lib/db/server";

describe("serviceDb idempotent upserts", () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.upsert.mockReset();
  });

  it.each(["saved_deals", "rejected_products", "auction_reminders"])(
    "uses the business unique key for %s",
    (table) => {
      const values = { user_id: "user-1", product_id: "product-1" };
      (serviceDb() as any).from(table).upsert(values);

      expect(mocks.upsert).toHaveBeenCalledWith(values, {
        onConflict: "user_id,product_id"
      });
    }
  );

  it("preserves an explicit conflict target", () => {
    const values = { user_id: "user-1", product_id: "product-1" };
    (serviceDb() as any).from("rejected_products").upsert(values, {
      onConflict: "id",
      ignoreDuplicates: true
    });

    expect(mocks.upsert).toHaveBeenCalledWith(values, {
      onConflict: "id",
      ignoreDuplicates: true
    });
  });

  it("does not alter unrelated table upserts", () => {
    const values = { id: "alert-1", status: "rejected" };
    (serviceDb() as any).from("alerts").upsert(values);

    expect(mocks.upsert).toHaveBeenCalledWith(values);
  });
});
