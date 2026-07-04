alter table public.market_comparables
  add column if not exists reference text,
  add column if not exists country text,
  add column if not exists fees numeric(12,2),
  add column if not exists notes text;

create table if not exists public.deal_score_comparables (
  id uuid primary key default gen_random_uuid(),
  deal_score_id uuid not null references public.deal_scores(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  source text not null,
  evidence_type text not null,
  title text,
  price numeric(12,2) not null,
  currency text not null,
  sold_at timestamptz,
  condition_grade text,
  brand text,
  model text,
  evidence_url text,
  confidence text not null default 'LOW',
  match_score numeric(5,4) not null,
  weight numeric(8,6) not null,
  created_at timestamptz not null default now()
);
alter table public.deal_score_comparables enable row level security;
create policy deal_score_comparables_owner_select on public.deal_score_comparables for select
using (user_id = public.current_app_user_id() or public.is_admin());
create index if not exists deal_score_comparables_score_idx on public.deal_score_comparables(deal_score_id);

alter table public.saved_deals
  add column if not exists lifecycle_status text not null default 'saved',
  add column if not exists purchased_at timestamptz,
  add column if not exists actual_buy_price numeric(12,2),
  add column if not exists sold_at timestamptz,
  add column if not exists actual_sale_price numeric(12,2),
  add column if not exists actual_fees numeric(12,2),
  add column if not exists actual_profit numeric(12,2);

alter table public.saved_deals drop constraint if exists saved_deals_lifecycle_status_check;
alter table public.saved_deals add constraint saved_deals_lifecycle_status_check
check (lifecycle_status in ('saved','purchased','listed','sold','abandoned'));
