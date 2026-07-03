import type { SourceAdapter } from "@/types";
import { mockAdapter } from "./mock.adapter";
import { ebayAdapter } from "./ebay.adapter";
import { ricardoAdapter } from "./ricardo.adapter";
import { buyeeAdapter } from "./buyee.adapter";
import { yahooJapanAdapter } from "./yahooJapan.adapter";
import { komehyoAdapter } from "./komehyo.adapter";
import { alevelAdapter } from "./alevel.adapter";
import { rssAdapter } from "./rss.adapter";
import { emailAlertsAdapter } from "./emailAlerts.adapter";

const adapters: SourceAdapter[] = [
  mockAdapter, ebayAdapter, ricardoAdapter, buyeeAdapter,
  yahooJapanAdapter, rssAdapter, emailAlertsAdapter, komehyoAdapter, alevelAdapter
];

export function adaptersFor(sources: string[]) {
  return adapters.filter((adapter) => adapter.enabled && sources.includes(adapter.name));
}
