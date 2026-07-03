import { serviceDb } from "@/lib/db/server";

export async function rateLimit(key: string, limit = 20, windowSeconds = 60) {
  const { data, error } = await serviceDb().rpc("consume_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds
  });
  return !error && data === true;
}
