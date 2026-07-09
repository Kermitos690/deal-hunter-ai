alter table public.radars drop constraint if exists radars_sources_supported_check;
alter table public.radars add constraint radars_sources_supported_check
check (
  cardinality(sources) > 0
  and sources <@ array['ebay','ricardo','anibis','komehyo','email-alerts','rss']::text[]
);
