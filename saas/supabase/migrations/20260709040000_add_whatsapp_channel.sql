alter table public.users add column if not exists whatsapp_phone text;
alter table public.users add column if not exists whatsapp_alerts_enabled boolean not null default false;
alter table public.users add column if not exists whatsapp_opt_in_at timestamptz;

create unique index if not exists users_whatsapp_phone_unique
on public.users (whatsapp_phone)
where whatsapp_phone is not null;

create table if not exists public.processed_whatsapp_messages (
  message_id text primary key,
  processed_at timestamptz not null default now()
);

alter table public.alerts add column if not exists whatsapp_message_id text;
alter table public.alerts add column if not exists whatsapp_sent_at timestamptz;
alter table public.alerts add column if not exists whatsapp_status text;
