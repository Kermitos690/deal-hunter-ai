-- Durable scheduler execution journal for production observability.

create table if not exists public.scheduler_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null check (job in ('scan', 'reminders', 'email-alerts')),
  status text not null default 'running' check (status in ('running', 'success', 'degraded', 'error')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  result_count integer not null default 0,
  error_count integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.scheduler_runs enable row level security;

create policy scheduler_runs_admin_select on public.scheduler_runs for select
using (public.is_admin());

create index if not exists scheduler_runs_job_started_idx
  on public.scheduler_runs(job, started_at desc);

create index if not exists scheduler_runs_status_started_idx
  on public.scheduler_runs(status, started_at desc);

revoke all on table public.scheduler_runs from public, anon, authenticated;
