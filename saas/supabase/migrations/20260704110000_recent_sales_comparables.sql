alter table public.market_comparables
  add column if not exists external_id text,
  add column if not exists title text,
  add column if not exists evidence_type text not null default 'SOLD',
  add column if not exists match_score numeric(4,3) not null default 0.750,
  add column if not exists fetched_at timestamptz not null default now(),
  add column if not exists raw_payload jsonb not null default '{}'::jsonb;

alter table public.market_comparables
  drop constraint if exists market_comparables_evidence_type_check;
alter table public.market_comparables
  add constraint market_comparables_evidence_type_check
  check (evidence_type in ('SOLD', 'ACTIVE_LISTING', 'MARKET_SIGNAL'));

create unique index if not exists market_comparables_source_external_uidx
  on public.market_comparables(source, external_id)
  where external_id is not null;
create index if not exists market_comparables_lookup_idx
  on public.market_comparables(category, brand, model, sold_at desc);
create index if not exists market_comparables_recent_sold_idx
  on public.market_comparables(sold_at desc)
  where evidence_type = 'SOLD';
