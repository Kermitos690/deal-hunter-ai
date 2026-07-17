import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeReturnPath, safeReturnPath } from "@/lib/security/return-path";

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}

describe("Telegram authentication return path", () => {
  it("accepts only internal dashboard and admin destinations", () => {
    expect(normalizeReturnPath("/dashboard/radars?active=1")).toBe("/dashboard/radars?active=1");
    expect(normalizeReturnPath("/admin/system-health")).toBe("/admin/system-health");
    expect(normalizeReturnPath("https://evil.example/admin")).toBeNull();
    expect(normalizeReturnPath("//evil.example/admin")).toBeNull();
    expect(normalizeReturnPath("/billing")).toBeNull();
    expect(safeReturnPath("javascript:alert(1)")).toBe("/dashboard");
  });

  it("stores the requested page before opening Telegram", () => {
    const startRoute = read("src/app/api/auth/telegram/start/route.ts");
    expect(startRoute).toContain("returnPathCookieName");
    expect(startRoute).toContain('telegramStartUrl("dashboard")');
    expect(startRoute).toContain("maxAge: 15 * 60");
  });

  it("consumes and clears the stored page after the signed Telegram session", () => {
    const sessionRoute = read("src/app/api/auth/telegram/session/route.ts");
    expect(sessionRoute).toContain("request.cookies.get(returnPathCookieName)?.value");
    expect(sessionRoute).toContain("new URL(returnTo, url)");
    expect(sessionRoute).toContain("response.cookies.delete(returnPathCookieName)");
  });

  it("offers connected administrators a direct health link", () => {
    const dashboard = read("src/app/dashboard/page.tsx");
    expect(dashboard).toContain('href="/admin/system-health"');
    expect(dashboard).toContain("user.role === \"admin\"");
  });
});
