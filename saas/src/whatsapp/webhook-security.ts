import crypto from "node:crypto";

export function verifyWhatsAppSignature(rawBody: string, signature: string | null, appSecret: string | undefined) {
  if (!signature || !appSecret || !signature.startsWith("sha256=")) return false;
  const supplied = signature.slice("sha256=".length);
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  if (supplied.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(supplied, "hex"), Buffer.from(expected, "hex"));
}
