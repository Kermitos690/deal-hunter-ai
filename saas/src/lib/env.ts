import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(16).optional(),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  ADMIN_TELEGRAM_ID: z.string().optional(),
  CRON_SECRET: z.string().min(16).optional(),
  SESSION_SECRET: z.string().min(32),
  ENABLE_MOCK_SOURCE: z.string().default("true"),
  ENABLE_EBAY_SOURCE: z.string().default("false"),
  EBAY_CLIENT_ID: z.string().optional(),
  EBAY_CLIENT_SECRET: z.string().optional(),
  EBAY_MARKETPLACES: z.string().default("EBAY_CH,EBAY_FR,EBAY_DE,EBAY_IT,EBAY_GB,EBAY_US"),
  ENABLE_YAHOO_JAPAN_SOURCE: z.string().default("false"),
  YAHOO_JAPAN_CLIENT_ID: z.string().optional(),
  ENABLE_RSS_SOURCE: z.string().default("false"),
  PUBLIC_FEED_URLS: z.string().optional(),
  ENABLE_EMAIL_ALERTS_SOURCE: z.string().default("false"),
  EMAIL_IMAP_SERVER: z.string().optional(),
  EMAIL_IMAP_PORT: z.string().default("993"),
  EMAIL_MAILBOX: z.string().default("INBOX"),
  EMAIL_LOOKBACK_HOURS: z.string().default("48"),
  EMAIL_MAX_MESSAGES: z.string().default("100"),
  EMAIL_ADDRESS: z.string().optional(),
  EMAIL_APP_PASSWORD: z.string().optional(),
  EMAIL_ALLOWED_SENDERS: z.string().optional(),
  EMAIL_ALERT_SCAN_LIMIT: z.string().default("10"),
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
