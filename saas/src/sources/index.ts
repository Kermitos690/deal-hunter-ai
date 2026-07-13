import type { SourceAdapter } from "@/types";
import { enrichPokemonCandidate, expandPokemonRadarForSources, isPokemonRadar } from "@/lib/tcg/pokemon";
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
  mockAdapter, ebayAdapter, ricardoAdapter, anibisAdapter, tuttiAdapter, buyeeAdapter,
  yahooJapanAdapter, rssAdapter, emailAlertsAdapter, komehyoAdapter, alevelAdapter
];

function withVerticalNormalization(adapter: SourceAdapter): SourceAdapter {
  return {
    ...adapter,
    async scan(radar) {
      const sourceRadar = isPokemonRadar(radar) ? expandPokemonRadarForSources(radar) : radar;
      const candidates = await adapter.scan(sourceRadar);
      return isPokemonRadar(radar) ? candidates.map(enrichPokemonCandidate) : candidates;
    }
  };
}

export function adaptersFor(sources: string[]) {
  return adapters
    .filter((adapter) => adapter.enabled && sources.includes(adapter.name))
    .map(withVerticalNormalization);
}
