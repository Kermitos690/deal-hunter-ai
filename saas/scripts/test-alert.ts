import { sendDealAlert } from "../src/telegram/send-alert";
import { mockCandidates } from "../src/sources/mock.adapter";
import { calculateDealScore } from "../src/scoring/calculate-deal-score";
import { estimateMarketValue } from "../src/market/market-estimator";
const telegramId = process.env.ADMIN_TELEGRAM_ID;
if (!telegramId) throw new Error("ADMIN_TELEGRAM_ID requis.");
const candidate = mockCandidates[0];
const radar: any = {
  id:"test", user_id:"test", name:"Test", category:"maroquinerie", brands:[],
  models:[], include_keywords:[], exclude_keywords:[], source_countries:[],
  target_country:"CH", max_buy_price:200, min_profit:20, min_roi_percent:10,
  min_score:55, accepted_conditions:["B"], sale_types:["BUY_NOW"], sources:["mock"],
  shipping_cost:10, customs_cost:0, vat_rate:0, platform_fee_rate:.12,
  payment_fee_rate:.03, repair_cost:0, scan_frequency_minutes:360,
  alerts_enabled:true, photos_required:true, auction_mode:false,
  auction_reminder_enabled:false, is_active:true
};
const score = calculateDealScore(candidate, radar, estimateMarketValue(candidate, radar));
console.log(await sendDealAlert(telegramId, "test-alert", candidate, score));
