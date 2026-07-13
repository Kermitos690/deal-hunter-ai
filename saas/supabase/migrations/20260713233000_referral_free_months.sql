-- Deal Hunter AI referral programme.
-- One first paid referred subscription grants one month to the referrer.

alter table public.users
  add column if not exists referral_code text,
  add column if not exists referred_by_user_id uuid references public.users(id) on delete set null,
  add column if not exists referral_months_earned integer not null default 0,
  add column if not exists referral_access_until timestamptz;

create unique index if not exists users_referral_code_unique_idx
  on public.users (lower(referral_code))
  where referral_code is not null;

create index if not exists users_referred_by_idx
  on public.users (referred_by_user_id)
  where referred_by_user_id is not null;

create or replace function public.assign_referral_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.referral_code is null or btrim(new.referral_code) = '' then
    new.referral_code := 'DH' || upper(substr(replace(coalesce(new.id, gen_random_uuid())::text, '-', ''), 1, 12));
  else
    new.referral_code := upper(btrim(new.referral_code));
  end if;
  return new;
end;
$$;

drop trigger if exists users_assign_referral_code on public.users;
create trigger users_assign_referral_code
before insert or update of referral_code on public.users
for each row execute function public.assign_referral_code();

update public.users
set referral_code = 'DH' || upper(substr(replace(id::text, '-', ''), 1, 12))
where referral_code is null or btrim(referral_code) = '';

alter table public.users
  alter column referral_code set not null;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references public.users(id) on delete cascade,
  referred_user_id uuid not null unique references public.users(id) on delete cascade,
  referral_code text not null,
  status text not null default 'pending'
    check (status in ('pending', 'qualified', 'rewarded', 'revoked')),
  qualifying_invoice_id text unique,
  qualified_at timestamptz,
  rewarded_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (referrer_user_id <> referred_user_id)
);

create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null unique references public.referrals(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  months integer not null default 1 check (months between 1 and 12),
  status text not null default 'available'
    check (status in ('available', 'applied', 'revoked')),
  available_at timestamptz not null default now(),
  applied_at timestamptz,
  revoked_at timestamptz,
  stripe_credit_amount bigint,
  stripe_credit_currency text,
  stripe_balance_transaction_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists referrals_referrer_status_idx
  on public.referrals (referrer_user_id, status, created_at desc);
create index if not exists referrals_referred_status_idx
  on public.referrals (referred_user_id, status);
create index if not exists referral_rewards_user_status_idx
  on public.referral_rewards (user_id, status, available_at);

drop trigger if exists referrals_touch on public.referrals;
create trigger referrals_touch before update on public.referrals
for each row execute function public.touch_updated_at();

drop trigger if exists referral_rewards_touch on public.referral_rewards;
create trigger referral_rewards_touch before update on public.referral_rewards
for each row execute function public.touch_updated_at();

alter table public.referrals enable row level security;
alter table public.referral_rewards enable row level security;

-- Users can see only their own referral activity. Writes go through server RPCs.
drop policy if exists referrals_participant_select on public.referrals;
create policy referrals_participant_select on public.referrals for select
using (
  referrer_user_id = public.current_app_user_id()
  or referred_user_id = public.current_app_user_id()
  or public.is_admin()
);

drop policy if exists referral_rewards_owner_select on public.referral_rewards;
create policy referral_rewards_owner_select on public.referral_rewards for select
using (user_id = public.current_app_user_id() or public.is_admin());

create or replace function public.claim_referral_code(
  p_referred_user_id uuid,
  p_referral_code text
)
returns table(referral_id uuid, referrer_user_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referred public.users%rowtype;
  v_referrer public.users%rowtype;
  v_referral public.referrals%rowtype;
begin
  select * into v_referred
  from public.users
  where id = p_referred_user_id
  for update;

  if v_referred.id is null then
    raise exception 'referred_user_not_found';
  end if;
  if v_referred.referred_by_user_id is not null then
    raise exception 'referral_already_claimed';
  end if;
  if v_referred.created_at < now() - interval '30 days' then
    raise exception 'referral_claim_window_expired';
  end if;
  if exists (
    select 1 from public.subscriptions
    where user_id = p_referred_user_id
      and status in ('active', 'trialing', 'past_due')
  ) then
    raise exception 'subscription_already_started';
  end if;

  select * into v_referrer
  from public.users
  where lower(referral_code) = lower(btrim(p_referral_code))
    and status = 'active'
  for share;

  if v_referrer.id is null then
    raise exception 'referral_code_invalid';
  end if;
  if v_referrer.id = p_referred_user_id then
    raise exception 'self_referral_forbidden';
  end if;

  insert into public.referrals (
    referrer_user_id,
    referred_user_id,
    referral_code
  ) values (
    v_referrer.id,
    p_referred_user_id,
    v_referrer.referral_code
  )
  on conflict (referred_user_id) do nothing
  returning * into v_referral;

  if v_referral.id is null then
    raise exception 'referral_already_claimed';
  end if;

  update public.users
  set referred_by_user_id = v_referrer.id
  where id = p_referred_user_id;

  return query select v_referral.id, v_referrer.id, v_referral.status;
end;
$$;

create or replace function public.qualify_paid_referral(
  p_referred_user_id uuid,
  p_invoice_id text
)
returns table(
  referral_id uuid,
  reward_id uuid,
  referrer_user_id uuid,
  access_until timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.referrals%rowtype;
  v_reward public.referral_rewards%rowtype;
  v_access_until timestamptz;
begin
  select * into v_referral
  from public.referrals
  where referred_user_id = p_referred_user_id
    and status = 'pending'
  for update;

  if v_referral.id is null then
    return;
  end if;

  update public.referrals
  set
    status = 'qualified',
    qualifying_invoice_id = p_invoice_id,
    qualified_at = now()
  where id = v_referral.id;

  insert into public.referral_rewards (referral_id, user_id, months)
  values (v_referral.id, v_referral.referrer_user_id, 1)
  on conflict (referral_id) do update
  set updated_at = now()
  returning * into v_reward;

  update public.users
  set
    referral_months_earned = referral_months_earned + 1,
    referral_access_until = greatest(now(), coalesce(referral_access_until, now())) + interval '1 month'
  where id = v_referral.referrer_user_id
  returning referral_access_until into v_access_until;

  update public.referrals
  set status = 'rewarded', rewarded_at = now()
  where id = v_referral.id;

  return query select v_referral.id, v_reward.id, v_referral.referrer_user_id, v_access_until;
end;
$$;

revoke all on function public.claim_referral_code(uuid, text) from public, anon, authenticated;
revoke all on function public.qualify_paid_referral(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_referral_code(uuid, text) to service_role;
grant execute on function public.qualify_paid_referral(uuid, text) to service_role;

grant select on public.referrals to authenticated;
grant select on public.referral_rewards to authenticated;
