import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { conflictTargetForTable, withDefaultUpsertConflict } from "@/lib/db/upsert-conflicts";

function configureIdempotentUpserts<T>(client: T): T {
  const mutableClient = client as any;
  const originalFrom = mutableClient.from.bind(mutableClient);

  mutableClient.from = (relation: string) => {
    const builder = originalFrom(relation);
    if (!conflictTargetForTable(relation)) return builder;

    const originalUpsert = builder.upsert.bind(builder);
    builder.upsert = (values: unknown, options?: Record<string, unknown>) =>
      originalUpsert(values, withDefaultUpsertConflict(relation, options));
    return builder;
  };

  return client;
}

export function serviceDb() {
  const config = env();
  const client = createClient(
    config.NEXT_PUBLIC_SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  return configureIdempotentUpserts(client);
}
