-- Port the remaining security/isolation hardening from the superseded PR #35.
-- Additive and idempotent: no production data is removed.

alter table public.processed_updates enable row level security;
alter table public.telegram_sessions enable row level security;
revoke all on table public.processed_updates from public, anon, authenticated;
revoke all on table public.telegram_sessions from public, anon, authenticated;

revoke all on function public.current_app_user_id() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.current_app_user_id() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;

-- Products and images must only be visible when they are related to the current
-- application user (or the caller is an administrator). This replaces the old
-- broad "any authenticated user" read policies.
drop policy if exists products_authenticated_select on public.products;
drop policy if exists products_related_select on public.products;
create policy products_related_select on public.products for select
using (
  public.is_admin()
  or exists (select 1 from public.deal_scores s where s.product_id = products.id and s.user_id = public.current_app_user_id())
  or exists (select 1 from public.alerts a where a.product_id = products.id and a.user_id = public.current_app_user_id())
  or exists (select 1 from public.saved_deals d where d.product_id = products.id and d.user_id = public.current_app_user_id())
  or exists (select 1 from public.rejected_products r where r.product_id = products.id and r.user_id = public.current_app_user_id())
  or exists (select 1 from public.user_seen_products v where v.product_id = products.id and v.user_id = public.current_app_user_id())
);

drop policy if exists images_authenticated_select on public.product_images;
drop policy if exists images_related_select on public.product_images;
create policy images_related_select on public.product_images for select
using (
  public.is_admin()
  or exists (
    select 1 from public.products p
    where p.id = product_images.product_id
      and (
        exists (select 1 from public.deal_scores s where s.product_id = p.id and s.user_id = public.current_app_user_id())
        or exists (select 1 from public.alerts a where a.product_id = p.id and a.user_id = public.current_app_user_id())
        or exists (select 1 from public.saved_deals d where d.product_id = p.id and d.user_id = public.current_app_user_id())
        or exists (select 1 from public.rejected_products r where r.product_id = p.id and r.user_id = public.current_app_user_id())
        or exists (select 1 from public.user_seen_products v where v.product_id = p.id and v.user_id = public.current_app_user_id())
      )
  )
);

create index if not exists radars_owner_active_due_idx on public.radars(user_id, is_active, next_scan_at);
create index if not exists alerts_owner_status_created_idx on public.alerts(user_id, status, created_at desc);
create index if not exists alerts_radar_status_created_idx on public.alerts(radar_id, status, created_at desc);
create index if not exists scores_owner_created_idx on public.deal_scores(user_id, created_at desc);
create index if not exists rejected_owner_created_idx on public.rejected_products(user_id, created_at desc);
create index if not exists seen_owner_first_seen_idx on public.user_seen_products(user_id, first_seen_at desc);
create index if not exists product_images_product_position_idx on public.product_images(product_id, position);
create index if not exists processed_updates_processed_at_idx on public.processed_updates(processed_at);
create index if not exists telegram_sessions_updated_at_idx on public.telegram_sessions(updated_at);
create index if not exists source_scan_logs_radar_started_idx on public.source_scan_logs(radar_id, started_at desc);
create index if not exists market_comparables_lookup_idx on public.market_comparables(category, brand, model, fetched_at desc);

alter table public.scan_logs
  add column if not exists engine_version text not null default 'scan-v1',
  add column if not exists alerts_created integer not null default 0,
  add column if not exists telegram_skipped integer not null default 0,
  add column if not exists rejection_summary jsonb not null default '{}',
  add column if not exists source_errors jsonb not null default '[]';
