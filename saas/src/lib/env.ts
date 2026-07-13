import { z } from "zod";

const booleanFlag = z.enum(["true", "false"]);

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(16).optional(),
  NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: z.string().min(1).optional(),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  ADMIN_TELEGRAM_ID: z.string().optional(),
  CRON_SECRET: z.string().min(16).optional(),
  SESSION_SECRET: z.string().min(32),
  BETA_PRIVATE_MODE: booleanFlag.default("true"),
  ENABLE_MOCK_SOURCE: booleanFlag.default("false"),
  ENABLE_EBAY_SOURCE: booleanFlag.default("false"),
  ENABLE_EBAY_PRIORITY_SOURCE: booleanFlag.default("false"),
  EBAY_CLIENT_ID: z.string().optional(),
  EBAY_CLIENT_SECRET: z.string().optional(),
  EBAY_MARKETPLACES: z.string().default("EBAY_CH,EBAY_FR,EBAY_DE,EBAY_IT,EBAY_GB,EBAY_US"),
  EBAY_REQUEST_TIMEOUT_MS: z.string().default("10000"),
  EBAY_REQUEST_CONCURRENCY: z.string().default("4"),
  EBAY_MAX_REQUESTS_PER_SCAN: z.string().default("48"),
  ENABLE_RICARDO_SOURCE: booleanFlag.default("false"),
  ENABLE_ANIBIS_SOURCE: booleanFlag.default("false"),
  ENABLE_TUTTI_SOURCE: booleanFlag.default("false"),
  ENABLE_KOMEHYO_SOURCE: booleanFlag.default("false"),
  ENABLE_YAHOO_JAPAN_SOURCE: booleanFlag.default("false"),
  YAHOO_JAPAN_CLIENT_ID: z.string().optional(),
  ENABLE_RSS_SOURCE: booleanFlag.default("false"),
  PUBLIC_FEED_URLS: z.string().optional(),
  ENABLE_EMAIL_ALERTS_SOURCE: booleanFlag.default("false"),
  LIVE_SOURCE_PROXY_URL: z.string().url().optional(),
  SWISS_SOURCE_PROXY_URL: z.string().url().optional(),
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
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SESSION_SECRET"
  ];
  return required.filter((name) => !process.env[name]);
}

export function productionConfigurationWarnings() {
  const warnings: string[] = [];
  if (process.env.ENABLE_MOCK_SOURCE === "true") warnings.push("mock_source_enabled");
  if (process.env.ENABLE_EBAY_SOURCE === "true" && (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET)) {
    warnings.push("ebay_enabled_without_credentials");
  }
  if (process.env.ENABLE_EMAIL_ALERTS_SOURCE === "true" && (!process.env.EMAIL_IMAP_SERVER || !process.env.EMAIL_ADDRESS || !process.env.EMAIL_APP_PASSWORD)) {
    warnings.push("email_alerts_enabled_without_complete_imap");
  }
  if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_WEBHOOK_SECRET) warnings.push("stripe_missing_webhook_secret");
  if (process.env.TELEGRAM_BOT_TOKEN && !process.env.TELEGRAM_WEBHOOK_SECRET) warnings.push("telegram_missing_webhook_secret");
  return warnings;
}
