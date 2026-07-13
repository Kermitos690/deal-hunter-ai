const USER_PRODUCT_CONFLICT_TABLES = new Set([
  "saved_deals",
  "rejected_products",
  "auction_reminders"
]);

export type UpsertOptions = Record<string, unknown> & {
  onConflict?: string;
};

export function normalizeUpsertOptions(
  table: string,
  options: UpsertOptions = {}
): UpsertOptions {
  if (!USER_PRODUCT_CONFLICT_TABLES.has(table) || options.onConflict) {
    return options;
  }

  return {
    ...options,
    onConflict: "user_id,product_id"
  };
}
