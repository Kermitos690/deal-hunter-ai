export {};

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const base = process.env.APP_BASE_URL;
if (!token || !secret || !base) throw new Error("TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET et APP_BASE_URL requis.");

const commands = [
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

async function telegramApi(method: string, payload: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await response.json();
  console.log(method, body);
}

const normalizedBase = base.replace(/\/$/, "");
await telegramApi("setMyCommands", { commands });
await telegramApi("setWebhook", {
  url: `${normalizedBase}/api/telegram/webhook`,
  secret_token: secret,
  allowed_updates: ["message", "callback_query"]
});
