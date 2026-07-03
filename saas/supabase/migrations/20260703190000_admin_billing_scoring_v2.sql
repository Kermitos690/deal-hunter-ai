alter table public.users
  add column if not exists status text not null default 'active'
    check (status in ('active', 'suspended')),
  add column if not exists stripe_customer_id text,
  add column if not exists admin_notes text;

create unique index if not exists users_stripe_customer_id_idx
  on public.users(stripe_customer_id)
  where stripe_customer_id is not null;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  provider text not null default 'stripe',
  customer_id text not null,
  subscription_id text unique,
  price_id text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'business')),
  status text not null default 'inactive',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

create table if not exists public.request_limits (
  key text primary key,
  request_count integer not null default 0,
  reset_at timestamptz not null
);

alter table public.deal_scores
  add column if not exists scoring_version text not null default 'v1',
  add column if not exists market_confidence text not null default 'LOW',
  add column if not exists comparable_count integer not null default 0;

drop trigger if exists subscriptions_touch on public.subscriptions;
create trigger subscriptions_touch before update on public.subscriptions
for each row execute function public.touch_updated_at();

alter table public.subscriptions enable row level security;
alter table public.billing_events enable row level security;
alter table public.request_limits enable row level security;

create policy subscriptions_owner_select on public.subscriptions for select
using (user_id = public.current_app_user_id() or public.is_admin());

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  insert into public.request_limits as limits (key, request_count, reset_at)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update
  set
    request_count = case
      when limits.reset_at <= now() then 1
      else limits.request_count + 1
    end,
    reset_at = case
      when limits.reset_at <= now() then now() + make_interval(secs => p_window_seconds)
      else limits.reset_at
    end
  returning request_count into next_count;

  return next_count <= p_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
