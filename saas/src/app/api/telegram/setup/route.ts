import { NextResponse } from "next/server";
import { apiUser, isAdmin, jsonError } from "@/lib/api";

const TELEGRAM_COMMANDS = [
  { command: "start", description: "Créer ou ouvrir mon compte" },
  { command: "menu", description: "Afficher le menu principal" },
  { command: "id", description: "Afficher mon identifiant Telegram" },
  { command: "radars", description: "Lister mes radars" },
  { command: "newradar", description: "Créer un radar" },
  { command: "inbox", description: "Trier mes opportunités" },
  { command: "deals", description: "Voir mes opportunités" },
  { command: "alerts", description: "Voir mes alertes" },
  { command: "status", description: "Voir l’état de mon compte" },
  { command: "settings", description: "Mes réglages" },
  { command: "language", description: "Choisir la langue" },
  { command: "whatsapp", description: "Lier mon numéro WhatsApp" },
  { command: "stop", description: "Suspendre les alertes" },
  { command: "resume", description: "Réactiver les alertes" },
  { command: "help", description: "Afficher l’aide" }
];

async function authorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`) return true;
  const auth = await apiUser();
  return "user" in auth && isAdmin(auth.user);
}

async function telegramApi(method: string, payload: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN manquant.");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000)
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) throw new Error(`${method} failed (${response.status})`);
  return body;
}

export async function GET() {
  return NextResponse.json(
    { error: "Utilise POST avec une session administrateur ou le secret cron." },
    { status: 405, headers: { Allow: "POST" } }
  );
}

export async function POST(request: Request) {
  if (!await authorized(request)) return jsonError("Accès administrateur requis.", 403);
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const base = process.env.APP_BASE_URL;
  if (!token || !webhookSecret || !base) {
    return jsonError("TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET et APP_BASE_URL requis.", 503);
  }
  try {
    const normalizedBase = base.replace(/\/$/, "");
    const webhookUrl = `${normalizedBase}/api/telegram/webhook`;
    const [identity, commands, webhook] = await Promise.all([
      telegramApi("getMe", {}),
      telegramApi("setMyCommands", { commands: TELEGRAM_COMMANDS }),
      telegramApi("setWebhook", {
        url: webhookUrl,
        secret_token: webhookSecret,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: false
      })
    ]);
    return NextResponse.json({
      ok: true,
      botUsername: identity.result?.username ?? null,
      commands: commands.ok,
      webhook: webhook.ok,
      commandCount: TELEGRAM_COMMANDS.length,
      webhookUrl,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Configuration Telegram impossible:", error instanceof Error ? error.message : "Erreur inconnue");
    return jsonError("Configuration Telegram impossible.", 502);
  }
}
