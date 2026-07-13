-- Additive production-readiness indexes and maintenance helpers.
-- This migration does not remove or rewrite existing data.

create index if not exists radars_user_active_due_idx
  on public.radars(user_id, is_active, next_scan_at);

create index if not exists alerts_user_status_created_idx
  on public.alerts(user_id, status, created_at desc);

create index if not exists alerts_radar_status_created_idx
  on public.alerts(radar_id, status, created_at desc);

create index if not exists deal_scores_user_created_idx
  on public.deal_scores(user_id, created_at desc);

create index if not exists products_normalized_url_lookup_idx
  on public.products(normalized_url)
  where normalized_url <> '';

create index if not exists products_fingerprint_lookup_idx
  on public.products(content_fingerprint)
  where content_fingerprint is not null;

create index if not exists saved_deals_user_created_idx
  on public.saved_deals(user_id, created_at desc);

create index if not exists rejected_products_user_created_idx
  on public.rejected_products(user_id, created_at desc);

create index if not exists processed_updates_processed_at_idx
  on public.processed_updates(processed_at);

create index if not exists telegram_sessions_updated_at_idx
  on public.telegram_sessions(updated_at);

create index if not exists scan_logs_status_started_idx
  on public.scan_logs(status, started_at desc);

create index if not exists source_scan_logs_radar_started_idx
  on public.source_scan_logs(radar_id, started_at desc);

create index if not exists market_comparables_reference_region_idx
  on public.market_comparables(brand, model, reference, country, sold_at desc);

create index if not exists billing_events_processed_at_idx
  on public.billing_events(processed_at desc);

create or replace function public.cleanup_processed_telegram_updates(
  p_before timestamptz default now() - interval '14 days'
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.processed_updates
  where processed_at < p_before;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_processed_telegram_updates(timestamptz) from public, anon, authenticated;
grant execute on function public.cleanup_processed_telegram_updates(timestamptz) to service_role;
