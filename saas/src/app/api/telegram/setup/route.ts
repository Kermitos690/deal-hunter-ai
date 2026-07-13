import { NextResponse } from "next/server";
import { currentUser } from "@/lib/security/session";
import { isAdmin } from "@/lib/api";

export const dynamic = "force-dynamic";

const TELEGRAM_COMMANDS = [
  { command: "start", description: "Créer ou ouvrir mon compte" },
  { command: "menu", description: "Afficher le menu principal" },
  { command: "id", description: "Afficher mon identifiant Telegram" },
  { command: "radars", description: "Lister mes radars" },
  { command: "newradar", description: "Créer un radar" },
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

type TelegramResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type TelegramBotInfo = {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
};

type TelegramWebhookInfo = {
  url?: string;
  pending_update_count?: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  allowed_updates?: string[];
};

function normalizedUsername(value?: string | null) {
  return String(value ?? "").trim().replace(/^@/, "").toLowerCase();
}

async function authorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (cronSecret && authorization === `Bearer ${cronSecret}`) return true;

  const user = await currentUser();
  return Boolean(user && isAdmin(user));
}

async function telegramApi<T>(method: string, payload: Record<string, unknown> = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN manquant.");

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8_000),
    cache: "no-store"
  });
  const body = await response.json().catch(() => null) as TelegramResponse<T> | null;
  if (!response.ok || !body?.ok || body.result === undefined) {
    throw new Error(`${method} failed with HTTP ${response.status}`);
  }
  return body.result;
}

async function configureTelegram(request: Request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const base = process.env.APP_BASE_URL;
  if (!token || !webhookSecret || !base) {
    return NextResponse.json({
      error: "TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET et APP_BASE_URL requis."
    }, { status: 503 });
  }

  try {
    const normalizedBase = base.replace(/\/$/, "");
    const webhookUrl = `${normalizedBase}/api/telegram/webhook`;
    const bot = await telegramApi<TelegramBotInfo>("getMe");
    const expectedUsername = normalizedUsername(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME);
    const actualUsername = normalizedUsername(bot.username);

    if (expectedUsername && actualUsername !== expectedUsername) {
      return NextResponse.json({
        error: "Le token Telegram ne correspond pas au bot attendu.",
        expectedUsername,
        actualUsername
      }, { status: 409 });
    }

    await Promise.all([
      telegramApi<boolean>("setMyCommands", { commands: TELEGRAM_COMMANDS }),
      telegramApi<boolean>("setWebhook", {
        url: webhookUrl,
        secret_token: webhookSecret,
        allowed_updates: ["message", "callback_query"]
      })
    ]);

    const webhook = await telegramApi<TelegramWebhookInfo>("getWebhookInfo");
    if (webhook.url !== webhookUrl) {
      throw new Error("Telegram webhook verification failed");
    }

    return NextResponse.json({
      ok: true,
      botUsername: bot.username ?? null,
      webhookUrl: webhook.url,
      commandCount: TELEGRAM_COMMANDS.length,
      pendingUpdateCount: webhook.pending_update_count ?? 0,
      lastErrorDate: webhook.last_error_date ?? null,
      lastErrorMessage: webhook.last_error_message ?? null,
      maxConnections: webhook.max_connections ?? null,
      allowedUpdates: webhook.allowed_updates ?? [],
      updatedAt: new Date().toISOString()
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Configuration Telegram impossible:", error instanceof Error ? error.message : "Erreur inconnue");
    return NextResponse.json({
      error: "Configuration Telegram impossible."
    }, { status: 502 });
  }
}

export async function POST(request: Request) {
  return configureTelegram(request);
}

// Kept for backward compatibility with the existing operations workflow. It is
// protected exactly like POST and no longer accepts secrets in the URL.
export async function GET(request: Request) {
  return configureTelegram(request);
}
