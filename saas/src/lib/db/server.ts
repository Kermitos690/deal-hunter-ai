import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { normalizeUpsertOptions, type UpsertOptions } from "@/lib/db/upsert-conflicts";

/**
 * Server-only Supabase client.
 *
 * Telegram deal actions repeatedly write to tables that are unique on
 * (user_id, product_id). Supabase/PostgREST otherwise defaults an upsert to the
 * primary key when no conflict target is provided, which can surface as
 * "Action impossible" after a repeated Save/Reject/Reminder click.
 *
 * Keep the existing call sites backwards-compatible while forcing the correct
 * composite conflict target for the affected tables.
 */
export function serviceDb() {
  const config = env();
  const client = createClient(
    config.NEXT_PUBLIC_SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const originalFrom = client.from.bind(client);
  (client as any).from = (table: string) => {
    const builder = originalFrom(table) as any;
    const originalUpsert = builder.upsert.bind(builder);

    builder.upsert = (values: unknown, options?: UpsertOptions) =>
      originalUpsert(values, normalizeUpsertOptions(table, options));

    return builder;
  };

  return client;
}
