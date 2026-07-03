import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export function serviceDb() {
  const config = env();
  return createClient(
    config.NEXT_PUBLIC_SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
