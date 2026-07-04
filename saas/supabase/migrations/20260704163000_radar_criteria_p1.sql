update public.radars
set sources = array['ebay','email-alerts','rss']
where not (sources <@ array['ebay','email-alerts','rss']::text[])
   or cardinality(sources) = 0;

update public.radars
set sale_types = (
  select coalesce(array_agg(value), array['BUY_NOW']::text[])
  from unnest(sale_types) value
  where value in ('BUY_NOW','AUCTION')
)
where not (sale_types <@ array['BUY_NOW','AUCTION']::text[])
   or cardinality(sale_types) = 0;

update public.radars
set source_countries = array_remove(source_countries, 'WORLD')
where source_countries @> array['WORLD']::text[];

alter table public.radars drop constraint if exists radars_sources_supported_check;
alter table public.radars add constraint radars_sources_supported_check
  check (cardinality(sources) > 0 and sources <@ array['ebay','email-alerts','rss']::text[]);

alter table public.radars drop constraint if exists radars_sale_types_supported_check;
alter table public.radars add constraint radars_sale_types_supported_check
  check (cardinality(sale_types) > 0 and sale_types <@ array['BUY_NOW','AUCTION']::text[]);
