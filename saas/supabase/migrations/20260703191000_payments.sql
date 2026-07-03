create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  invoice_id text not null unique,
  customer_id text not null,
  subscription_id text,
  amount_due integer not null default 0,
  amount_paid integer not null default 0,
  currency text not null,
  status text not null,
  hosted_invoice_url text,
  invoice_pdf text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_user_created_idx
  on public.payments(user_id, created_at desc);

drop trigger if exists payments_touch on public.payments;
create trigger payments_touch before update on public.payments
for each row execute function public.touch_updated_at();

alter table public.payments enable row level security;

create policy payments_owner_select on public.payments for select
using (user_id = public.current_app_user_id() or public.is_admin());
