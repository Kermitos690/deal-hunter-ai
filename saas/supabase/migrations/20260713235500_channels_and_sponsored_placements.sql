-- Curated Deal Hunter channels and transparent sponsored placements.
-- Sponsored content is stored separately and never affects deal scoring.

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  category text,
  filter_json jsonb not null default '{}',
  status text not null default 'active'
    check (status in ('active', 'paused', 'archived')),
  is_public boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.channel_subscriptions (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  notification_mode text not null default 'dashboard'
    check (notification_mode in ('dashboard', 'telegram', 'both', 'none')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(channel_id, user_id)
);

create table if not exists public.channel_posts (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  post_type text not null default 'deal'
    check (post_type in ('deal', 'editorial')),
  product_id uuid references public.products(id) on delete set null,
  deal_score_id uuid references public.deal_scores(id) on delete set null,
  source_alert_id uuid references public.alerts(id) on delete set null,
  title text not null,
  summary text not null default '',
  image_url text,
  destination_url text,
  rank_score numeric(10,2) not null default 0,
  status text not null default 'published'
    check (status in ('draft', 'published', 'expired', 'removed')),
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(channel_id, product_id)
);

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website_url text,
  contact_email text,
  status text not null default 'active'
    check (status in ('active', 'paused', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sponsored_campaigns (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete cascade,
  category text,
  name text not null,
  headline text not null,
  body text not null default '',
  image_url text,
  destination_url text not null,
  disclosure_label text not null default 'Sponsorisé',
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'active', 'paused', 'ended', 'rejected')),
  starts_at timestamptz,
  ends_at timestamptz,
  impression_limit integer check (impression_limit is null or impression_limit >= 0),
  click_limit integer check (click_limit is null or click_limit >= 0),
  daily_frequency_cap integer not null default 1 check (daily_frequency_cap between 1 and 20),
  impressions_count integer not null default 0,
  clicks_count integer not null default 0,
  created_by_user_id uuid references public.users(id) on delete set null,
  approved_by_user_id uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sponsored_impressions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.sponsored_campaigns(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  channel_id uuid references public.channels(id) on delete set null,
  impression_day date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.sponsored_clicks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.sponsored_campaigns(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  channel_id uuid references public.channels(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists channels_public_order_idx
  on public.channels(status, is_public, sort_order, name);
create index if not exists channel_subscriptions_user_idx
  on public.channel_subscriptions(user_id, created_at desc);
create index if not exists channel_posts_feed_idx
  on public.channel_posts(channel_id, status, published_at desc, rank_score desc);
create index if not exists sponsored_campaigns_delivery_idx
  on public.sponsored_campaigns(status, channel_id, category, starts_at, ends_at);
create index if not exists sponsored_impressions_frequency_idx
  on public.sponsored_impressions(campaign_id, user_id, impression_day);
create index if not exists sponsored_clicks_campaign_idx
  on public.sponsored_clicks(campaign_id, created_at desc);

drop trigger if exists channels_touch on public.channels;
create trigger channels_touch before update on public.channels
for each row execute function public.touch_updated_at();

drop trigger if exists channel_subscriptions_touch on public.channel_subscriptions;
create trigger channel_subscriptions_touch before update on public.channel_subscriptions
for each row execute function public.touch_updated_at();

drop trigger if exists channel_posts_touch on public.channel_posts;
create trigger channel_posts_touch before update on public.channel_posts
for each row execute function public.touch_updated_at();

drop trigger if exists sponsors_touch on public.sponsors;
create trigger sponsors_touch before update on public.sponsors
for each row execute function public.touch_updated_at();

drop trigger if exists sponsored_campaigns_touch on public.sponsored_campaigns;
create trigger sponsored_campaigns_touch before update on public.sponsored_campaigns
for each row execute function public.touch_updated_at();

alter table public.channels enable row level security;
alter table public.channel_subscriptions enable row level security;
alter table public.channel_posts enable row level security;
alter table public.sponsors enable row level security;
alter table public.sponsored_campaigns enable row level security;
alter table public.sponsored_impressions enable row level security;
alter table public.sponsored_clicks enable row level security;

drop policy if exists channels_public_select on public.channels;
create policy channels_public_select on public.channels for select
using ((is_public and status = 'active') or public.is_admin());

drop policy if exists channel_subscriptions_owner_select on public.channel_subscriptions;
create policy channel_subscriptions_owner_select on public.channel_subscriptions for select
using (user_id = public.current_app_user_id() or public.is_admin());

drop policy if exists channel_posts_public_select on public.channel_posts;
create policy channel_posts_public_select on public.channel_posts for select
using (
  (
    status = 'published'
    and (published_at is null or published_at <= now())
    and (expires_at is null or expires_at > now())
  )
  or public.is_admin()
);

drop policy if exists sponsors_admin_select on public.sponsors;
create policy sponsors_admin_select on public.sponsors for select
using (public.is_admin());

drop policy if exists sponsored_campaigns_admin_select on public.sponsored_campaigns;
create policy sponsored_campaigns_admin_select on public.sponsored_campaigns for select
using (public.is_admin());

drop policy if exists sponsored_impressions_owner_select on public.sponsored_impressions;
create policy sponsored_impressions_owner_select on public.sponsored_impressions for select
using (user_id = public.current_app_user_id() or public.is_admin());

drop policy if exists sponsored_clicks_owner_select on public.sponsored_clicks;
create policy sponsored_clicks_owner_select on public.sponsored_clicks for select
using (user_id = public.current_app_user_id() or public.is_admin());

create or replace function public.subscribe_channel(
  p_user_id uuid,
  p_channel_slug text,
  p_notification_mode text default 'dashboard'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_channel_id uuid;
  v_subscription_id uuid;
begin
  if p_notification_mode not in ('dashboard', 'telegram', 'both', 'none') then
    raise exception 'invalid_notification_mode';
  end if;

  select id into v_channel_id
  from public.channels
  where slug = lower(btrim(p_channel_slug))
    and status = 'active'
    and is_public = true;

  if v_channel_id is null then
    raise exception 'channel_not_found';
  end if;

  insert into public.channel_subscriptions(channel_id, user_id, notification_mode)
  values (v_channel_id, p_user_id, p_notification_mode)
  on conflict (channel_id, user_id) do update
  set notification_mode = excluded.notification_mode, updated_at = now()
  returning id into v_subscription_id;

  return v_subscription_id;
end;
$$;

create or replace function public.unsubscribe_channel(
  p_user_id uuid,
  p_channel_slug text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted uuid;
begin
  delete from public.channel_subscriptions subscriptions
  using public.channels channels
  where subscriptions.channel_id = channels.id
    and subscriptions.user_id = p_user_id
    and channels.slug = lower(btrim(p_channel_slug))
  returning subscriptions.id into v_deleted;
  return v_deleted is not null;
end;
$$;

create or replace function public.record_sponsored_impression(
  p_campaign_id uuid,
  p_user_id uuid,
  p_channel_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.sponsored_campaigns%rowtype;
  v_today_count integer;
begin
  select * into v_campaign
  from public.sponsored_campaigns
  where id = p_campaign_id
  for update;

  if v_campaign.id is null
     or v_campaign.status not in ('approved', 'active')
     or (v_campaign.starts_at is not null and v_campaign.starts_at > now())
     or (v_campaign.ends_at is not null and v_campaign.ends_at <= now())
     or (v_campaign.impression_limit is not null and v_campaign.impressions_count >= v_campaign.impression_limit)
  then
    return false;
  end if;

  select count(*) into v_today_count
  from public.sponsored_impressions
  where campaign_id = p_campaign_id
    and user_id = p_user_id
    and impression_day = current_date;

  if v_today_count >= v_campaign.daily_frequency_cap then
    return false;
  end if;

  insert into public.sponsored_impressions(campaign_id, user_id, channel_id)
  values (p_campaign_id, p_user_id, p_channel_id);

  update public.sponsored_campaigns
  set impressions_count = impressions_count + 1
  where id = p_campaign_id;

  return true;
end;
$$;

create or replace function public.record_sponsored_click(
  p_campaign_id uuid,
  p_user_id uuid,
  p_channel_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.sponsored_campaigns%rowtype;
begin
  select * into v_campaign
  from public.sponsored_campaigns
  where id = p_campaign_id
  for update;

  if v_campaign.id is null
     or v_campaign.status not in ('approved', 'active')
     or (v_campaign.starts_at is not null and v_campaign.starts_at > now())
     or (v_campaign.ends_at is not null and v_campaign.ends_at <= now())
     or (v_campaign.click_limit is not null and v_campaign.clicks_count >= v_campaign.click_limit)
  then
    return null;
  end if;

  insert into public.sponsored_clicks(campaign_id, user_id, channel_id)
  values (p_campaign_id, p_user_id, p_channel_id);

  update public.sponsored_campaigns
  set clicks_count = clicks_count + 1
  where id = p_campaign_id;

  return v_campaign.destination_url;
end;
$$;

revoke all on function public.subscribe_channel(uuid, text, text) from public, anon, authenticated;
revoke all on function public.unsubscribe_channel(uuid, text) from public, anon, authenticated;
revoke all on function public.record_sponsored_impression(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.record_sponsored_click(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.subscribe_channel(uuid, text, text) to service_role;
grant execute on function public.unsubscribe_channel(uuid, text) to service_role;
grant execute on function public.record_sponsored_impression(uuid, uuid, uuid) to service_role;
grant execute on function public.record_sponsored_click(uuid, uuid, uuid) to service_role;

insert into public.channels(slug, name, description, category, filter_json, sort_order)
values
  ('pokemon-general', 'Pokémon — toutes les opportunités', 'Cartes raw, slabs, scellé et lots sélectionnés par Deal Hunter AI.', 'Cartes à collectionner', '{"franchise":"pokemon"}', 10),
  ('pokemon-2025-2026', 'Pokémon — sorties 2025–2026', 'Extensions récentes, produits scellés et cartes à forte actualité.', 'Cartes à collectionner', '{"franchise":"pokemon","releaseYears":[2025,2026]}', 20),
  ('pokemon-graded', 'Pokémon — cartes gradées', 'PSA, BGS, CGC, SGC, ACE et PCA avec grade et certification.', 'Cartes à collectionner', '{"franchise":"pokemon","productTypes":["GRADED_CARD"]}', 30),
  ('pokemon-sealed', 'Pokémon — produits scellés', 'Displays, ETB, booster bundles, blisters, tins et cases.', 'Cartes à collectionner', '{"franchise":"pokemon","productTypes":["SEALED_PRODUCT"]}', 40),
  ('pokemon-vintage', 'Pokémon — vintage', 'Cartes anciennes, premières éditions, holo et promos.', 'Cartes à collectionner', '{"franchise":"pokemon","maxReleaseYear":2003}', 50),
  ('pokemon-boutiques', 'Pokémon — lots pour boutiques', 'Collections, classeurs et lots adaptés au tri et à la revente unitaire.', 'Cartes à collectionner', '{"franchise":"pokemon","productTypes":["LOT_COLLECTION"]}', 60),
  ('montres-opportunites', 'Montres — opportunités', 'Montres complètes avec marge, comparables et risque documentés.', 'Montres', '{}', 100)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  filter_json = excluded.filter_json,
  sort_order = excluded.sort_order,
  updated_at = now();
