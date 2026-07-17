import { telegramReturnPayload } from "@/lib/security/return-path";

const DEFAULT_BOT_USERNAME = "deal_hunter_cards_bot";

export type TelegramStartPayload = "dashboard" | "newradar" | "radars" | "deals" | "alerts" | "settings" | `return_${string}`;

export function telegramBotUsername() {
  return (process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || DEFAULT_BOT_USERNAME).replace(/^@/, "");
}

export function telegramStartUrl(payload: TelegramStartPayload = "dashboard") {
  return `https://t.me/${telegramBotUsername()}?start=${encodeURIComponent(payload)}`;
}

export function telegramLoginStartUrl(returnTo?: string | null) {
  return telegramStartUrl(telegramReturnPayload(returnTo) as TelegramStartPayload);
}

export function telegramBotUrl() {
  return `https://t.me/${telegramBotUsername()}`;
}

export const TELEGRAM_COMMANDS = [
  { command: "/newradar", label: "Créer un radar" },
  { command: "/radars", label: "Mes radars" },
  { command: "/deals", label: "Mes deals" },
  { command: "/alerts", label: "Alertes" },
  { command: "/stop", label: "Pause alertes" },
  { command: "/resume", label: "Reprendre" }
];
