import type { Radar } from "@/types";
export const radar: Radar = {
  id:"r1",user_id:"u1",name:"LV B",category:"maroquinerie",brands:["Louis Vuitton"],
  models:[],include_keywords:[],exclude_keywords:["replica"],source_countries:["CH"],
  target_country:"CH",max_buy_price:200,min_profit:20,min_roi_percent:15,min_score:60,
  accepted_conditions:["B"],sale_types:["BUY_NOW"],sources:["mock"],shipping_cost:10,
  customs_cost:0,vat_rate:0,platform_fee_rate:.12,payment_fee_rate:.03,repair_cost:0,
  scan_frequency_minutes:360,alerts_enabled:true,photos_required:true,auction_mode:false,
  auction_reminder_enabled:false,is_active:true
};
