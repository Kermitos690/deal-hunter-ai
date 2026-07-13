import type { SourceAdapter } from "@/types";
import { mockAdapter } from "./mock.adapter";
import { ebayAdapter } from "./ebay.adapter";
import { ricardoAdapter } from "./ricardo.adapter";
import { anibisAdapter } from "./anibis.adapter";
import { tuttiAdapter } from "./tutti.adapter";
import { buyeeAdapter } from "./buyee.adapter";
import { yahooJapanAdapter } from "./yahooJapan.adapter";
import { komehyoAdapter } from "./komehyo.adapter";
import { alevelAdapter } from "./alevel.adapter";
import { rssAdapter } from "./rss.adapter";
import { emailAlertsAdapter } from "./emailAlerts.adapter";

const adapters: SourceAdapter[] = [
  mockAdapter,
  ebayAdapter,
  ricardoAdapter,
  anibisAdapter,
  tuttiAdapter,
  buyeeAdapter,
  yahooJapanAdapter,
  rssAdapter,
  emailAlertsAdapter,
  komehyoAdapter,
  alevelAdapter
];

const explicitFlags: Record<string, string> = {
  mock: "ENABLE_MOCK_SOURCE",
  ebay: "ENABLE_EBAY_SOURCE",
  ricardo: "ENABLE_RICARDO_SOURCE",
  anibis: "ENABLE_ANIBIS_SOURCE",
  tutti: "ENABLE_TUTTI_SOURCE",
  komehyo: "ENABLE_KOMEHYO_SOURCE",
  "yahoo-japan": "ENABLE_YAHOO_JAPAN_SOURCE",
  rss: "ENABLE_RSS_SOURCE",
  "email-alerts": "ENABLE_EMAIL_ALERTS_SOURCE"
};

export function sourceExplicitlyEnabled(source: string) {
  if (process.env.NODE_ENV === "test") return true;
  const flag = explicitFlags[source];
  return flag ? process.env[flag] === "true" : false;
}

export function adaptersFor(sources: string[]) {
  return adapters.filter((adapter) =>
    adapter.enabled && sources.includes(adapter.name) && sourceExplicitlyEnabled(adapter.name)
  );
}
