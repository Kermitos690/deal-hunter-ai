export type ConditionGrade = "NEW" | "A" | "B" | "C" | "REPAIR" | "UNKNOWN";
export type Recommendation = "BUY" | "NEGOTIATE" | "WATCH" | "AVOID";
export type MarketConfidence = "LOW" | "MEDIUM" | "HIGH";
export type Plan = "free" | "pro" | "business";

export interface AppUser {
  id: string;
  telegram_id: string | null;
  email: string | null;
  display_name: string;
  role: "user" | "admin";
  plan: Plan;
  status: "active" | "suspended";
  alerts_enabled: boolean;
  whatsapp_phone?: string | null;
  whatsapp_alerts_enabled?: boolean;
  whatsapp_opt_in_at?: string | null;
  stripe_customer_id?: string | null;
}

export interface Radar {
  id: string;
  user_id: string;
  name: string;
  category: string;
  brands: string[];
  models: string[];
  include_keywords: string[];
  exclude_keywords: string[];
  source_countries: string[];
  target_country: string;
  max_buy_price: number;
  total_budget?: number | null;
  min_profit: number;
  min_roi_percent: number;
  min_score: number;
  accepted_conditions: ConditionGrade[];
  sale_types: string[];
  sources: string[];
  shipping_cost: number;
  customs_cost: number;
  vat_rate: number;
  platform_fee_rate: number;
  payment_fee_rate: number;
  repair_cost: number;
  scan_frequency_minutes: number;
  alerts_enabled: boolean;
  photos_required: boolean;
  auction_mode: boolean;
  auction_reminder_enabled: boolean;
  is_active: boolean;
  last_scanned_at?: string | null;
  next_scan_at?: string | null;
}

export interface ProductCandidate {
  source: string;
  sourceItemId: string;
  title: string;
  brand?: string;
  model?: string;
  category?: string;
  priceAmount: number;
  priceCurrency: string;
  buyNowPrice?: number;
  currentBidPrice?: number;
  auctionEndAt?: string;
  saleType?: "BUY_NOW" | "AUCTION";
  shippingCost?: number;
  conditionText?: string;
  conditionGrade?: ConditionGrade;
  sellerName?: string;
  sellerRating?: string;
  sellerCountry?: string;
  itemCountry?: string;
  productUrl: string;
  imageUrls: string[];
  description?: string;
  rawPayload?: Record<string, unknown>;
}

export interface MarketEstimate {
  low: number;
  median: number;
  high: number;
  currency: string;
  confidence: MarketConfidence;
  comparableCount: number;
  comparableSources: string[];
  notes: string[];
  comparableDetails: MarketComparableDetail[];
}

export interface MarketComparableDetail {
  source: string;
  evidenceType: "SOLD" | "ACTIVE_LISTING" | "MARKET_SIGNAL";
  title?: string | null;
  price: number;
  currency: string;
  soldAt?: string | null;
  conditionGrade?: string | null;
  brand?: string | null;
  model?: string | null;
  evidenceUrl?: string | null;
  confidence?: string | null;
  matchScore: number;
  weight: number;
}

export interface DealScore {
  totalScore: number;
  marginScore: number;
  liquidityScore: number;
  riskScore: number;
  conditionScore: number;
  urgencyScore: number;
  estimatedBuyCost: number;
  estimatedResalePrice: number;
  estimatedNetProfit: number;
  estimatedRoiPercent: number;
  maximumOffer?: number;
  breakEvenResalePrice?: number;
  recommendedChannel?: string;
  estimatedSaleDays?: number;
  actionPlan?: string;
  evidenceGrade?: "A" | "B" | "C" | "D";
  decisionStatus?: "APPROVED" | "CONDITIONAL" | "REVIEW_REQUIRED" | "REJECTED";
  decisionRationale?: string;
  recommendation: Recommendation;
  scoringVersion: "v2" | "v3" | "v4";
  marketConfidence: MarketConfidence;
  comparableCount: number;
  reasons: string[];
  warnings: string[];
}

export interface SourceAdapter {
  name: string;
  enabled: boolean;
  scan(radar: Radar): Promise<ProductCandidate[]>;
}
