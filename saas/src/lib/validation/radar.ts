import { z } from "zod";

const conditions = z.enum(["NEW", "A", "B", "C", "REPAIR", "UNKNOWN"]);
const saleTypes = z.enum(["BUY_NOW", "AUCTION"]);
const sources = z.enum(["ebay", "ricardo", "anibis", "tutti", "komehyo", "email-alerts", "rss"]);
const countries = z.enum(["CH","FR","DE","IT","GB","US","CA","AU","JP","EU"]);

export const radarSchema = z.object({
  name: z.string().trim().min(2).max(80),
  category: z.string().trim().min(2).max(60),
  brands: z.array(z.string()).default([]),
  models: z.array(z.string()).default([]),
  include_keywords: z.array(z.string()).default([]),
  exclude_keywords: z.array(z.string()).default([]),
  source_countries: z.array(countries).default([]),
  target_country: z.string().default("CH"),
  max_buy_price: z.coerce.number().positive(),
  total_budget: z.coerce.number().positive().nullable().optional(),
  min_profit: z.coerce.number().min(0).default(0),
  min_roi_percent: z.coerce.number().min(0).default(0),
  min_score: z.coerce.number().int().min(0).max(100).default(70),
  accepted_conditions: z.array(conditions).min(1).default(["A", "B"]),
  sale_types: z.array(saleTypes).min(1).default(["BUY_NOW"]),
  sources: z.array(sources).min(1).default(["ebay", "ricardo", "anibis", "tutti"]),
  shipping_cost: z.coerce.number().min(0).default(0),
  customs_cost: z.coerce.number().min(0).default(0),
  vat_rate: z.coerce.number().min(0).max(1).default(0),
  platform_fee_rate: z.coerce.number().min(0).max(1).default(0.12),
  payment_fee_rate: z.coerce.number().min(0).max(1).default(0.03),
  repair_cost: z.coerce.number().min(0).default(0),
  scan_frequency_minutes: z.coerce.number().int().min(15).default(360),
  alerts_enabled: z.boolean().default(true),
  photos_required: z.boolean().default(true),
  auction_mode: z.boolean().default(false),
  auction_reminder_enabled: z.boolean().default(false),
  is_active: z.boolean().default(true)
});

export type RadarInput = z.infer<typeof radarSchema>;
