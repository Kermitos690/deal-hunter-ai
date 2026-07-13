export {};

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const base = process.env.APP_BASE_URL;
const expectedUsername = String(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "")
  .trim()
  .replace(/^@/, "")
  .toLowerCase();

if (!token || !secret || !base) {
  throw new Error("TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET et APP_BASE_URL requis.");
}

const commands = [
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

type TelegramResponse<T> = { ok: boolean; result?: T; description?: string };

async function telegramApi<T>(method: string, payload: Record<string, unknown> = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8_000)
  });
  const body = await response.json().catch(() => null) as TelegramResponse<T> | null;
  if (!response.ok || !body?.ok || body.result === undefined) {
    throw new Error(`${method} failed with HTTP ${response.status}`);
  }
  return body.result;
}

const normalizedBase = base.replace(/\/$/, "");
const webhookUrl = `${normalizedBase}/api/telegram/webhook`;
const bot = await telegramApi<{ username?: string }>("getMe");
const actualUsername = String(bot.username ?? "").toLowerCase();
if (expectedUsername && actualUsername !== expectedUsername) {
  throw new Error(`Le token correspond à @${actualUsername || "inconnu"}, pas à @${expectedUsername}.`);
}

await telegramApi<boolean>("setMyCommands", { commands });
await telegramApi<boolean>("setWebhook", {
  url: webhookUrl,
  secret_token: secret,
  allowed_updates: ["message", "callback_query"]
});
const webhook = await telegramApi<{
  url?: string;
  pending_update_count?: number;
  last_error_message?: string;
}>("getWebhookInfo");
if (webhook.url !== webhookUrl) throw new Error("Le webhook Telegram n’a pas été enregistré sur l’URL attendue.");

console.log(JSON.stringify({
  ok: true,
  botUsername: bot.username ?? null,
  webhookUrl: webhook.url,
  pendingUpdateCount: webhook.pending_update_count ?? 0,
  lastErrorMessage: webhook.last_error_message ?? null,
  commandCount: commands.length
}, null, 2));
