alter table public.users
  add column if not exists preferred_language text not null default 'fr'
  check (preferred_language in ('fr', 'en', 'de', 'it'));

