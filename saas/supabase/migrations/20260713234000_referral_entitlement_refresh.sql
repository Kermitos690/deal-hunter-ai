alter table public.users
  add column if not exists referral_promoted_from_free boolean not null default false;

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
    referral_access_until = greatest(now(), coalesce(referral_access_until, now())) + interval '1 month',
    referral_promoted_from_free = referral_promoted_from_free or plan = 'free',
    plan = case when plan = 'free' then 'pro' else plan end
  where id = v_referral.referrer_user_id
  returning referral_access_until into v_access_until;

  update public.referrals
  set status = 'rewarded', rewarded_at = now()
  where id = v_referral.id;

  return query select v_referral.id, v_reward.id, v_referral.referrer_user_id, v_access_until;
end;
$$;

create or replace function public.refresh_referral_entitlements()
returns table(promoted integer, expired integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promoted integer := 0;
  v_expired integer := 0;
begin
  update public.users
  set
    referral_promoted_from_free = true,
    plan = 'pro'
  where referral_access_until > now()
    and plan = 'free';
  get diagnostics v_promoted = row_count;

  update public.users as users
  set
    plan = 'free',
    referral_promoted_from_free = false
  where users.referral_promoted_from_free = true
    and (users.referral_access_until is null or users.referral_access_until <= now())
    and not exists (
      select 1 from public.subscriptions subscriptions
      where subscriptions.user_id = users.id
        and subscriptions.status in ('active', 'trialing', 'past_due')
        and subscriptions.plan in ('pro', 'business')
    );
  get diagnostics v_expired = row_count;

  return query select v_promoted, v_expired;
end;
$$;

revoke all on function public.refresh_referral_entitlements() from public, anon, authenticated;
grant execute on function public.refresh_referral_entitlements() to service_role;
