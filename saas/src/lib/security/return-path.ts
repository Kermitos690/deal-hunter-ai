const ALLOWED_ROOTS = ["/dashboard", "/admin"] as const;

export const returnPathCookieName = "deal_hunter_return_to";

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
