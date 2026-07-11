export type TelegramLanguage = "fr" | "en" | "de" | "it";

export const SUPPORTED_TELEGRAM_LANGUAGES: TelegramLanguage[] = ["fr", "en", "de", "it"];

export function normalizeTelegramLanguage(value?: string | null): TelegramLanguage {
  const code = String(value ?? "").toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_TELEGRAM_LANGUAGES.includes(code as TelegramLanguage) ? code as TelegramLanguage : "fr";
}

const COPY = {
  fr: {
    account: "Compte",
    chooseAction: "Choisis une action.",
    createRadar: "➕ Créer un radar",
    myRadars: "📡 Mes radars",
    latestAlerts: "🚨 Dernières alertes",
    deals: "⭐ Deals",
    dashboard: "🌐 Dashboard",
    language: "🌍 Langue",
    helpTitle: "Commandes disponibles :",
    helpMenu: "/menu — menu principal",
    helpNewRadar: "/newradar — créer un radar",
    helpRadars: "/radars — voir et scanner tes radars",
    helpInbox: "/inbox — trier les opportunités par catégories",
    helpAlerts: "/alerts — dernières alertes",
    helpDeals: "/deals — meilleures opportunités",
    helpStatus: "/status — état du compte",
    helpSettings: "/settings — ouvrir le dashboard",
    helpLanguage: "/language — choisir la langue",
    helpStop: "/stop — suspendre les alertes",
    helpResume: "/resume — réactiver les alertes",
    languagePrompt: "Choisis la langue du bot.",
    languageSaved: "Langue enregistrée.",
    languageUnavailable: "La préférence de langue sera disponible dès que la migration Supabase sera appliquée."
  },
  en: {
    account: "Account",
    chooseAction: "Choose an action.",
    createRadar: "➕ Create radar",
    myRadars: "📡 My radars",
    latestAlerts: "🚨 Latest alerts",
    deals: "⭐ Deals",
    dashboard: "🌐 Dashboard",
    language: "🌍 Language",
    helpTitle: "Available commands:",
    helpMenu: "/menu — main menu",
    helpNewRadar: "/newradar — create a radar",
    helpRadars: "/radars — view and scan your radars",
    helpInbox: "/inbox — triage opportunities by category",
    helpAlerts: "/alerts — latest alerts",
    helpDeals: "/deals — best opportunities",
    helpStatus: "/status — account status",
    helpSettings: "/settings — open dashboard",
    helpLanguage: "/language — choose language",
    helpStop: "/stop — pause alerts",
    helpResume: "/resume — resume alerts",
    languagePrompt: "Choose the bot language.",
    languageSaved: "Language saved.",
    languageUnavailable: "Language preference will be available once the Supabase migration is applied."
  },
  de: {
    account: "Konto",
    chooseAction: "Wähle eine Aktion.",
    createRadar: "➕ Radar erstellen",
    myRadars: "📡 Meine Radare",
    latestAlerts: "🚨 Letzte Alerts",
    deals: "⭐ Deals",
    dashboard: "🌐 Dashboard",
    language: "🌍 Sprache",
    helpTitle: "Verfügbare Befehle:",
    helpMenu: "/menu — Hauptmenü",
    helpNewRadar: "/newradar — Radar erstellen",
    helpRadars: "/radars — Radare anzeigen und scannen",
    helpInbox: "/inbox — Chancen nach Kategorien prüfen",
    helpAlerts: "/alerts — letzte Alerts",
    helpDeals: "/deals — beste Chancen",
    helpStatus: "/status — Kontostatus",
    helpSettings: "/settings — Dashboard öffnen",
    helpLanguage: "/language — Sprache wählen",
    helpStop: "/stop — Alerts pausieren",
    helpResume: "/resume — Alerts reaktivieren",
    languagePrompt: "Wähle die Sprache des Bots.",
    languageSaved: "Sprache gespeichert.",
    languageUnavailable: "Die Spracheinstellung ist verfügbar, sobald die Supabase-Migration angewendet wurde."
  },
  it: {
    account: "Account",
    chooseAction: "Scegli un'azione.",
    createRadar: "➕ Crea radar",
    myRadars: "📡 I miei radar",
    latestAlerts: "🚨 Ultimi alert",
    deals: "⭐ Deal",
    dashboard: "🌐 Dashboard",
    language: "🌍 Lingua",
    helpTitle: "Comandi disponibili:",
    helpMenu: "/menu — menu principale",
    helpNewRadar: "/newradar — crea un radar",
    helpRadars: "/radars — vedi e scansiona i tuoi radar",
    helpInbox: "/inbox — valuta le opportunità per categoria",
    helpAlerts: "/alerts — ultimi alert",
    helpDeals: "/deals — migliori opportunità",
    helpStatus: "/status — stato account",
    helpSettings: "/settings — apri dashboard",
    helpLanguage: "/language — scegli lingua",
    helpStop: "/stop — sospendi alert",
    helpResume: "/resume — riattiva alert",
    languagePrompt: "Scegli la lingua del bot.",
    languageSaved: "Lingua salvata.",
    languageUnavailable: "La preferenza lingua sarà disponibile quando la migrazione Supabase sarà applicata."
  }
} satisfies Record<TelegramLanguage, Record<string, string>>;

export function t(lang: TelegramLanguage, key: keyof typeof COPY.fr) {
  return COPY[lang]?.[key] ?? COPY.fr[key];
}

export function languageKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🇫🇷 Français", callback_data: "lang:fr" },
        { text: "🇬🇧 English", callback_data: "lang:en" }
      ],
      [
        { text: "🇩🇪 Deutsch", callback_data: "lang:de" },
        { text: "🇮🇹 Italiano", callback_data: "lang:it" }
      ]
    ]
  };
}

