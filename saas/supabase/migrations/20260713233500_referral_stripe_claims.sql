alter table public.referral_rewards
  drop constraint if exists referral_rewards_status_check;

alter table public.referral_rewards
  add constraint referral_rewards_status_check
  check (status in ('available', 'applying', 'applied', 'revoked'));

create or replace function public.claim_referral_reward_for_stripe(
  p_reward_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed uuid;
begin
  update public.referral_rewards
  set status = 'applying', updated_at = now()
  where id = p_reward_id
    and user_id = p_user_id
    and status = 'available'
  returning id into v_claimed;

  return v_claimed is not null;
end;
$$;

create or replace function public.release_referral_reward_stripe_claim(
  p_reward_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_released uuid;
begin
  update public.referral_rewards
  set status = 'available', updated_at = now()
  where id = p_reward_id
    and user_id = p_user_id
    and status = 'applying'
  returning id into v_released;

  return v_released is not null;
end;
$$;

revoke all on function public.claim_referral_reward_for_stripe(uuid, uuid) from public, anon, authenticated;
revoke all on function public.release_referral_reward_stripe_claim(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_referral_reward_for_stripe(uuid, uuid) to service_role;
grant execute on function public.release_referral_reward_stripe_claim(uuid, uuid) to service_role;
