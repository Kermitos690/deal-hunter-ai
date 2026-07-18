import { t, type TelegramLanguage } from "@/telegram/i18n";
import { ADMIN_REFILL_CALLBACK } from "@/telegram/admin-inbox-refill";

export function mainMenuText(displayName: string, lang: TelegramLanguage = "fr") {
  return [
    "Menu Deal Hunter AI",
    "",
    `${t(lang, "account")} : ${displayName}`,
    t(lang, "chooseAction")
  ].join("\n");
}

export function mainMenuKeyboard(dashboardUrl: string, lang: TelegramLanguage = "fr") {
  return {
    inline_keyboard: [
      [{ text: t(lang, "createRadar"), callback_data: "create_radar" }],
      [{ text: t(lang, "myRadars"), callback_data: "list_radars" }],
      [{ text: t(lang, "latestAlerts"), callback_data: "list_alerts" }, { text: t(lang, "deals"), callback_data: "list_deals" }],
      [{ text: "🛠 Remplir l’Inbox (admin)", callback_data: ADMIN_REFILL_CALLBACK }],
      [{ text: t(lang, "dashboard"), url: dashboardUrl }, { text: t(lang, "language"), callback_data: "language" }]
    ]
  };
}
