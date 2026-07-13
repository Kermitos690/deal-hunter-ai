-- Bound auction reminder delivery retries and expose failure diagnostics.

alter table public.auction_reminders
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists last_error text;

alter table public.auction_reminders
  drop constraint if exists auction_reminders_attempt_count_check;
alter table public.auction_reminders
  add constraint auction_reminders_attempt_count_check
  check (attempt_count between 0 and 10);

create index if not exists auction_reminders_pending_attempts_idx
  on public.auction_reminders(status, remind_at, attempt_count)
  where status = 'pending';
