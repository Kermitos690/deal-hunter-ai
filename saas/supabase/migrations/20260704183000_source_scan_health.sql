create table if not exists public.source_scan_logs (
  id uuid primary key default gen_random_uuid(),
  scan_log_id uuid not null references public.scan_logs(id) on delete cascade,
  radar_id uuid not null references public.radars(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  source text not null,
  status text not null,
  candidates_found integer not null default 0,
  duration_ms integer not null default 0,
  error_message text,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.source_scan_logs enable row level security;
create policy source_scan_logs_owner_select on public.source_scan_logs for select
using (user_id = public.current_app_user_id() or public.is_admin());
create index if not exists source_scan_logs_source_time_idx on public.source_scan_logs(source, started_at desc);
create index if not exists source_scan_logs_scan_idx on public.source_scan_logs(scan_log_id);
