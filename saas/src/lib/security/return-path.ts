const ALLOWED_ROOTS = ["/dashboard", "/admin"] as const;
const TELEGRAM_RETURN_PREFIX = "return_";
const MAX_TELEGRAM_START_PAYLOAD_LENGTH = 64;

export function normalizeReturnPath(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\") || trimmed.includes("\0")) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, "https://deal-hunter.invalid");
    const allowed = ALLOWED_ROOTS.some(
      (root) => parsed.pathname === root || parsed.pathname.startsWith(`${root}/`)
    );
    if (!allowed || parsed.origin !== "https://deal-hunter.invalid") return null;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

export function safeReturnPath(value?: string | null, fallback = "/dashboard") {
  return normalizeReturnPath(value) ?? fallback;
}

export function telegramReturnPayload(value?: string | null) {
  const returnTo = safeReturnPath(value);
  const encoded = Buffer.from(returnTo, "utf8").toString("base64url");
  const payload = `${TELEGRAM_RETURN_PREFIX}${encoded}`;
  return payload.length <= MAX_TELEGRAM_START_PAYLOAD_LENGTH ? payload : "dashboard";
}

export function returnPathFromTelegramStartPayload(payload?: string | null): string | null {
  if (!payload?.startsWith(TELEGRAM_RETURN_PREFIX)) return null;
  try {
    const decoded = Buffer.from(payload.slice(TELEGRAM_RETURN_PREFIX.length), "base64url").toString("utf8");
    return normalizeReturnPath(decoded);
  } catch {
    return null;
  }
}
