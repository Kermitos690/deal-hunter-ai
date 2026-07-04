create table if not exists public.radar_scan_locks (
  radar_id uuid primary key references public.radars(id) on delete cascade,
  lock_token uuid not null,
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.radar_scan_locks enable row level security;

create or replace function public.acquire_radar_scan_lock(
  p_radar_id uuid,
  p_lock_token uuid,
  p_ttl_seconds integer default 900
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  insert into public.radar_scan_locks(radar_id, lock_token, acquired_at, expires_at)
  values (
    p_radar_id,
    p_lock_token,
    now(),
    now() + make_interval(secs => greatest(60, least(p_ttl_seconds, 3600)))
  )
  on conflict (radar_id) do update
    set lock_token = excluded.lock_token,
        acquired_at = excluded.acquired_at,
        expires_at = excluded.expires_at
    where public.radar_scan_locks.expires_at <= now();
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

create or replace function public.release_radar_scan_lock(
  p_radar_id uuid,
  p_lock_token uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  delete from public.radar_scan_locks
  where radar_id = p_radar_id and lock_token = p_lock_token;
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

revoke all on table public.radar_scan_locks from public, anon, authenticated;
revoke all on function public.acquire_radar_scan_lock(uuid, uuid, integer) from public;
revoke all on function public.release_radar_scan_lock(uuid, uuid) from public;
grant execute on function public.acquire_radar_scan_lock(uuid, uuid, integer) to service_role;
grant execute on function public.release_radar_scan_lock(uuid, uuid) to service_role;

update public.scan_logs
set status = 'error',
    finished_at = now(),
    error_message = coalesce(error_message, 'Scan interrompu : verrou historique expiré.')
where status = 'running'
  and started_at < now() - interval '15 minutes';

create index if not exists radar_scan_locks_expiry_idx
  on public.radar_scan_locks(expires_at);
