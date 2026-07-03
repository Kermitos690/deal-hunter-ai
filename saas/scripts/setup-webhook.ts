export {};

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const base = process.env.APP_BASE_URL;
if (!token || !secret || !base) throw new Error("TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET et APP_BASE_URL requis.");
const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    url: `${base.replace(/\/$/, "")}/api/telegram/webhook`,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"]
  })
});
console.log(await response.json());
