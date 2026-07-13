const IDEMPOTENT_UPSERT_CONFLICTS: Readonly<Record<string, string>> = {
  saved_deals: "user_id,product_id",
  rejected_products: "user_id,product_id",
  auction_reminders: "user_id,product_id"
};

export function conflictTargetForTable(table: string) {
  return IDEMPOTENT_UPSERT_CONFLICTS[table] ?? null;
}

export function withDefaultUpsertConflict(
  table: string,
  options: Record<string, unknown> | undefined
) {
  const conflictTarget = conflictTargetForTable(table);
  if (!conflictTarget || options?.onConflict) return options ?? {};
  return { ...(options ?? {}), onConflict: conflictTarget };
}
