export const SCAN_LOCK_TTL_SECONDS = 15 * 60;

export function userCanRunActivity(status?: string | null) {
  return status === "active";
}

export function lockIsExpired(expiresAt: string, now = Date.now()) {
  const expiry = new Date(expiresAt).getTime();
  return !Number.isFinite(expiry) || expiry <= now;
}
