import { z } from "zod";

const optionalUrl = z.preprocess(
  (value) => value === "" ? undefined : value,
  z.string().url().optional()
);

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(16).optional(),
  NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: z.string().optional(),
  TELEGRAM_ALERT_DELIVERY_MODE: z.enum(["digest", "individual"]).default("digest"),
  TELEGRAM_MAX_IMMEDIATE_ALERTS_PER_SCAN: z.string().default("0"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  ADMIN_TELEGRAM_ID: z.string().optional(),
  CRON_SECRET: z.string().min(16).optional(),
  SESSION_SECRET: z.string().min(32),
  PRIVATE_BETA_MODE: z.string().default("true"),
  ENABLE_MOCK_SOURCE: z.string().default("false"),
  ENABLE_EBAY_SOURCE: z.string().default("false"),
  ENABLE_EBAY_PRIORITY_SOURCE: z.string().default("true"),
  EBAY_CLIENT_ID: z.string().optional(),
  EBAY_CLIENT_SECRET: z.string().optional(),
  EBAY_MARKETPLACES: z.string().default("EBAY_CH,EBAY_FR,EBAY_DE,EBAY_IT,EBAY_GB,EBAY_US"),
  EBAY_DELIVERY_COUNTRY: z.string().default("CH"),
  EBAY_PRIORITY_MARKETPLACES: z.string().optional(),
  EBAY_PRIORITY_SELLERS: z.string().optional(),
  EBAY_PRIORITY_SOURCE_URLS: z.string().optional(),
  EBAY_PRIORITY_JAPAN_ONLY: z.string().default("true"),
  ENABLE_RICARDO_SOURCE: z.string().default("false"),
  ENABLE_ANIBIS_SOURCE: z.string().default("false"),
  ENABLE_TUTTI_SOURCE: z.string().default("false"),
  ENABLE_KOMEHYO_SOURCE: z.string().default("false"),
  ENABLE_YAHOO_JAPAN_SOURCE: z.string().default("false"),
  YAHOO_JAPAN_CLIENT_ID: z.string().optional(),
  ENABLE_RSS_SOURCE: z.string().default("false"),
  PUBLIC_FEED_URLS: z.string().optional(),
  ENABLE_EMAIL_ALERTS_SOURCE: z.string().default("false"),
  LIVE_SOURCE_PROXY_URL: optionalUrl,
  SWISS_SOURCE_PROXY_URL: optionalUrl,
  LOCAL_LIVE_SCAN_LIMIT: z.string().default("20"),
  LOCAL_LIVE_SCAN_DELAY_MS: z.string().default("2000"),
  EMAIL_IMAP_SERVER: z.string().optional(),
  EMAIL_IMAP_PORT: z.string().default("993"),
  EMAIL_MAILBOX: z.string().default("INBOX"),
  EMAIL_LOOKBACK_HOURS: z.string().default("48"),
  EMAIL_MAX_MESSAGES: z.string().default("100"),
  EMAIL_ADDRESS: z.string().optional(),
  EMAIL_APP_PASSWORD: z.string().optional(),
  EMAIL_ALLOWED_SENDERS: z.string().optional(),
  EMAIL_ALERT_SCAN_LIMIT: z.string().default("10"),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_GRAPH_VERSION: z.string().default("v23.0"),
  YANDEX_TRANSLATE_API_KEY: z.string().optional(),
  YANDEX_TRANSLATE_FOLDER_ID: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRO_PRICE_ID: z.string().optional(),
  STRIPE_BUSINESS_PRICE_ID: z.string().optional()
});

export function env() {
  return schema.parse(process.env);
}

export function missingEnvironmentVariables() {
  return [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SESSION_SECRET"
  ].filter((name) => !process.env[name]);
}

export function productionReadinessIssues() {
  const issues: string[] = [];
  if (process.env.NODE_ENV !== "production") return issues;
  if (process.env.ENABLE_MOCK_SOURCE === "true") {
    issues.push("ENABLE_MOCK_SOURCE doit être false en production bêta.");
  }
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_WEBHOOK_SECRET) {
    issues.push("Telegram incomplet.");
  }
  if (!process.env.CRON_SECRET) issues.push("CRON_SECRET manquant.");
  const realSourceEnabled = [
    "ENABLE_EBAY_SOURCE",
    "ENABLE_RICARDO_SOURCE",
    "ENABLE_ANIBIS_SOURCE",
    "ENABLE_TUTTI_SOURCE",
    "ENABLE_KOMEHYO_SOURCE",
    "ENABLE_RSS_SOURCE",
    "ENABLE_EMAIL_ALERTS_SOURCE",
    "ENABLE_YAHOO_JAPAN_SOURCE"
  ].some((name) => process.env[name] === "true");
  if (!realSourceEnabled) issues.push("Aucune source réelle activée.");
  return issues;
}
