alter table public.radars drop constraint if exists radars_sources_supported_check;
alter table public.radars add constraint radars_sources_supported_check
check (
  cardinality(sources) > 0
  and sources <@ array['ebay','komehyo','email-alerts','rss']::text[]
);

create unique index if not exists market_comparables_source_external_full_uidx
  on public.market_comparables(source, external_id);
