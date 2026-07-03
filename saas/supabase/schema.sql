create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  telegram_id text unique,
  email text,
  display_name text not null default 'Deal Hunter',
  role text not null default 'user' check (role in ('user', 'admin')),
  plan text not null default 'free' check (plan in ('free', 'pro', 'business')),
  alerts_enabled boolean not null default true,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.radars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  category text not null,
  brands text[] not null default '{}',
  models text[] not null default '{}',
  include_keywords text[] not null default '{}',
  exclude_keywords text[] not null default '{}',
  source_countries text[] not null default '{}',
  target_country text not null default 'CH',
  max_buy_price numeric(12,2) not null check (max_buy_price > 0),
  total_budget numeric(12,2),
  min_profit numeric(12,2) not null default 0,
  min_roi_percent numeric(8,2) not null default 0,
  min_score integer not null default 70 check (min_score between 0 and 100),
  accepted_conditions text[] not null default '{"NEW","A","B","C","REPAIR","UNKNOWN"}',
  sale_types text[] not null default '{"BUY_NOW","AUCTION","LOT","B2B"}',
  sources text[] not null default '{"mock"}',
  shipping_cost numeric(12,2) not null default 0,
  customs_cost numeric(12,2) not null default 0,
  vat_rate numeric(6,4) not null default 0,
  platform_fee_rate numeric(6,4) not null default 0.12,
  payment_fee_rate numeric(6,4) not null default 0.03,
  repair_cost numeric(12,2) not null default 0,
  scan_frequency_minutes integer not null default 360 check (scan_frequency_minutes >= 15),
  alerts_enabled boolean not null default true,
  photos_required boolean not null default true,
  auction_mode boolean not null default false,
  auction_reminder_enabled boolean not null default false,
  is_active boolean not null default true,
  last_scanned_at timestamptz,
  next_scan_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_item_id text not null,
  title text not null,
  brand text,
  model text,
  category text,
  price_amount numeric(12,2) not null,
  price_currency text not null,
  buy_now_price numeric(12,2),
  current_bid_price numeric(12,2),
  shipping_cost numeric(12,2) not null default 0,
  condition_text text,
  condition_grade text not null default 'UNKNOWN',
  seller_name text,
  seller_rating text,
  seller_country text,
  item_country text,
  product_url text not null,
  normalized_url text not null,
  description text,
  auction_end_at timestamptz,
  raw_payload jsonb not null default '{}',
  content_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source, source_item_id)
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  position integer not null default 0,
  image_hash text,
  created_at timestamptz not null default now(),
  unique(product_id, image_url)
);

create table if not exists public.market_comparables (
  id uuid primary key default gen_random_uuid(),
  brand text,
  model text,
  category text,
  condition_grade text,
  sold_price numeric(12,2) not null,
  currency text not null default 'CHF',
  source text not null,
  sold_at timestamptz,
  evidence_url text,
  confidence text not null default 'LOW',
  created_at timestamptz not null default now()
);

create table if not exists public.deal_scores (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  radar_id uuid not null references public.radars(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  total_score integer not null,
  margin_score integer not null,
  liquidity_score integer not null,
  risk_score integer not null,
  condition_score integer not null,
  urgency_score integer not null,
  estimated_buy_cost numeric(12,2) not null,
  estimated_resale_price numeric(12,2) not null,
  estimated_net_profit numeric(12,2) not null,
  estimated_roi_percent numeric(8,2) not null,
  recommendation text not null,
  reasons text[] not null default '{}',
  warnings text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique(product_id, radar_id)
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  radar_id uuid not null references public.radars(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  deal_score_id uuid not null references public.deal_scores(id) on delete cascade,
  telegram_message_id text,
  status text not null default 'sent',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, radar_id, product_id)
);

create table if not exists public.saved_deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  unique(user_id, product_id)
);

create table if not exists public.user_seen_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  unique(user_id, product_id)
);

create table if not exists public.rejected_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique(user_id, product_id)
);

create table if not exists public.auction_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  radar_id uuid not null references public.radars(id) on delete cascade,
  remind_at timestamptz not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique(user_id, product_id)
);

create table if not exists public.scan_logs (
  id uuid primary key default gen_random_uuid(),
  radar_id uuid not null references public.radars(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  candidates_found integer not null default 0,
  alerts_sent integer not null default 0,
  error_message text
);

create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  action text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.processed_updates (
  update_id bigint primary key,
  processed_at timestamptz not null default now()
);

create table if not exists public.telegram_sessions (
  telegram_id text primary key,
  state text not null,
  payload jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create index if not exists users_telegram_id_idx on public.users(telegram_id);
create index if not exists radars_user_id_idx on public.radars(user_id);
create index if not exists radars_due_idx on public.radars(is_active, next_scan_at);
create index if not exists products_source_item_idx on public.products(source, source_item_id);
create index if not exists products_normalized_url_idx on public.products(normalized_url);
create index if not exists products_fingerprint_idx on public.products(content_fingerprint);
create index if not exists alerts_user_id_idx on public.alerts(user_id);
create index if not exists seen_user_product_idx on public.user_seen_products(user_id, product_id);
create index if not exists reminders_due_idx on public.auction_reminders(remind_at, status);
create index if not exists scan_logs_radar_idx on public.scan_logs(radar_id, started_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_touch on public.users;
create trigger users_touch before update on public.users
for each row execute function public.touch_updated_at();

drop trigger if exists radars_touch on public.radars;
create trigger radars_touch before update on public.radars
for each row execute function public.touch_updated_at();

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
for each row execute function public.touch_updated_at();
