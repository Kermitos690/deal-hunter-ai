import crypto from "node:crypto";

export type TelegramLoginPayload = Record<string, string> & {
  id: string;
  auth_date: string;
  hash: string;
};

export function verifyTelegramLogin(
  payload: TelegramLoginPayload,
  botToken: string,
  maxAgeSeconds = 86400
) {
  if (!payload || typeof payload.hash !== "string" || !/^[a-f0-9]{64}$/i.test(payload.hash)) return false;
  if (!payload.id || !payload.auth_date) return false;
  const age = Math.floor(Date.now() / 1000) - Number(payload.auth_date);
  if (!Number.isFinite(age) || age < 0 || age > maxAgeSeconds) return false;
  const checkString = Object.entries(payload)
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = crypto.createHash("sha256").update(botToken).digest();
  const digest = crypto.createHmac("sha256", secret).update(checkString).digest("hex");
  const supplied = Buffer.from(payload.hash, "hex");
  const expected = Buffer.from(digest, "hex");
  return supplied.length === expected.length && crypto.timingSafeEqual(expected, supplied);
}
