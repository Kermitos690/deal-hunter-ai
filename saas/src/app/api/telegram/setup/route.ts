import { NextResponse } from "next/server";

const TELEGRAM_SETUP_SECRET = "dealhunter-setup-gaetan-2026-telegram";

const TELEGRAM_COMMANDS = [
  { command: "start", description: "Créer ou ouvrir mon compte" },
  { command: "id", description: "Afficher mon identifiant Telegram" },
  { command: "radars", description: "Lister mes radars" },
  { command: "newradar", description: "Créer un radar" },
  { command: "deals", description: "Voir mes opportunités" },
  { command: "alerts", description: "Voir mes alertes" },
  { command: "settings", description: "Mes réglages" },
  { command: "whatsapp", description: "Lier mon numéro WhatsApp" },
  { command: "stop", description: "Suspendre les alertes" },
  { command: "resume", description: "Réactiver les alertes" },
  { command: "help", description: "Afficher l’aide" }
];

function authorized(request: Request) {
  const url = new URL(request.url);
  const provided = url.searchParams.get("secret");
  const cronSecret = process.env.CRON_SECRET;
  return provided === TELEGRAM_SETUP_SECRET ||
    Boolean(cronSecret && (
      request.headers.get("authorization") === `Bearer ${cronSecret}` || provided === cronSecret
    ));
}

async function telegramApi(method: string, payload: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN manquant.");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) {
    throw new Error(`${method} failed: ${JSON.stringify(body)}`);
  }
  return body;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const base = process.env.APP_BASE_URL;
  if (!token || !webhookSecret || !base) {
    return NextResponse.json({
      error: "TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET et APP_BASE_URL requis."
    }, { status: 500 });
  }

  try {
    const normalizedBase = base.replace(/\/$/, "");
    const [commands, webhook] = await Promise.all([
      telegramApi("setMyCommands", { commands: TELEGRAM_COMMANDS }),
      telegramApi("setWebhook", {
        url: `${normalizedBase}/api/telegram/webhook`,
        secret_token: webhookSecret,
        allowed_updates: ["message", "callback_query"]
      })
    ]);

    return NextResponse.json({
      ok: true,
      commands: commands.ok,
      webhook: webhook.ok,
      commandCount: TELEGRAM_COMMANDS.length,
      webhookUrl: `${normalizedBase}/api/telegram/webhook`,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Configuration Telegram impossible:", error);
    return NextResponse.json({
      error: "Configuration Telegram impossible.",
      details: error instanceof Error ? error.message : "Erreur inconnue"
    }, { status: 500 });
  }
}
