import fs from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}

describe("Telegram broadcast center", () => {
  it("keeps the release announcement factual and transparent", () => {
    const source = read("src/telegram/broadcast.ts");

    expect(source).toContain("🚀 <b>DEAL HUNTER AI — NOUVELLE VERSION</b> 🚀");
    expect(source).toContain("lunettes mascotte");
    expect(source).toContain("eBay, Ricardo, Anibis, Tutti et Komehyo");
    expect(source).toContain("elle ne garantit pas qu’un deal apparaîtra");
    expect(source).not.toMatch(/deal(?:s)? garanti/i);
  });

  it("adds navigation buttons below release messages", () => {
    const source = read("src/telegram/broadcast.ts");

    expect(source).toContain("🔎 Mes radars");
    expect(source).toContain("📥 Inbox");
    expect(source).toContain("🧭 Menu");
  });

  it("sends previews only to the configured primary administrator", () => {
    const source = read("src/telegram/broadcast.ts");
    const trigger = read("src/app/api/internal/release-preview/dh-qie-20260715-a91f5e/route.ts");

    expect(source).toContain("process.env.ADMIN_TELEGRAM_ID");
    expect(source).toContain("scope: \"preview\"");
    expect(trigger).toContain("ADMIN_TELEGRAM_ID");
    expect(trigger).toContain("processed_updates");
    expect(trigger).toContain("CLAIM_ID = -20260715091");
  });

  it("requires a preview and explicit DIFFUSER confirmation before mass delivery", () => {
    const route = read("src/app/api/admin/telegram-broadcasts/[id]/dispatch/route.ts");
    const console = read("src/components/admin-telegram-broadcast-console.tsx");

    expect(route).toContain('z.literal("DIFFUSER")');
    expect(route).toContain("Envoie d’abord un aperçu à ton compte Telegram");
    expect(route).toContain("Validation finale requise");
    expect(console).toContain("🧪 Envoyer à mon compte");
    expect(console).toContain("Écrire DIFFUSER");
    expect(console).toContain("window.confirm");
  });

  it("treats every attempted recipient as terminal for one campaign run", () => {
    const source = read("src/telegram/broadcast.ts");

    expect(source).toContain('["sent", "failed", "blocked", "skipped"]');
    expect(source).toContain("const hasMore = eligible.length > batch.length");
  });

  it("excludes users who previously blocked the bot and records delivery outcomes", () => {
    const source = read("src/telegram/broadcast.ts");

    expect(source).toContain('contains("payload", { status: "blocked" })');
    expect(source).toContain('action: `${EVENT_PREFIX}delivery`');
    expect(source).toContain("failed_count");
    expect(source).toContain("blocked_count");
  });

  it("links the communications center from the primary admin page", () => {
    const admin = read("src/app/admin/page.tsx");
    const page = read("src/app/admin/communications/page.tsx");

    expect(admin).toContain('href="/admin/communications"');
    expect(page).toContain("Diffusion Telegram");
    expect(page).toContain("requireAdmin");
  });
});
