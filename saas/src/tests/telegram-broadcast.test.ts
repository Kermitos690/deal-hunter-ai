import fs from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return fs.readFileSync(path, "utf8");
}

describe("Telegram broadcast center", () => {
  it("keeps the release announcement factual, differentiated and transparent", () => {
    const source = read("src/telegram/broadcast.ts");

    expect(source).toContain("⚡ <b>DEAL HUNTER AI PASSE AU NIVEAU SUPÉRIEUR</b>");
    expect(source).toContain("eBay, Ricardo, Anibis, Tutti et Komehyo");
    expect(source).toContain("preuves de ventes");
    expect(source).toContain("Mieux vaut zéro alerte qu’une fausse opportunité");
    expect(source).not.toMatch(/deal(?:s)? garanti/i);
  });

  it("adds localized, action-first navigation below release messages", () => {
    const source = read("src/telegram/broadcast.ts");

    expect(source).toContain("⚡ Tester mes radars");
    expect(source).toContain("📥 Voir l’Inbox");
    expect(source).toContain("🧭 Menu principal");
    expect(source).toContain("⚡ Test my radars");
    expect(source).toContain("broadcastKeyboard(recipient.preferred_language");
  });

  it("sends previews only through the permanent authenticated admin route", () => {
    const source = read("src/telegram/broadcast.ts");
    const route = read("src/app/api/admin/telegram-broadcasts/[id]/preview/route.ts");

    expect(source).toContain("process.env.ADMIN_TELEGRAM_ID");
    expect(source).toContain("scope: \"preview\"");
    expect(route).toContain("apiUser");
    expect(route).toContain("isAdmin(auth.user)");
    expect(route).toContain("sendBroadcastPreview(id, auth.user.id)");
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
