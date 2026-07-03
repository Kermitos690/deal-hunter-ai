alter table public.users enable row level security;
alter table public.radars enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.deal_scores enable row level security;
alter table public.alerts enable row level security;
alter table public.saved_deals enable row level security;
alter table public.user_seen_products enable row level security;
alter table public.rejected_products enable row level security;
alter table public.auction_reminders enable row level security;
alter table public.scan_logs enable row level security;
alter table public.admin_logs enable row level security;
alter table public.market_comparables enable row level security;

create or replace function public.current_app_user_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.users where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.users where auth_user_id = auth.uid()), false);
$$;

create policy users_own_select on public.users for select
using (id = public.current_app_user_id() or public.is_admin());
create policy users_own_update on public.users for update
using (id = public.current_app_user_id() or public.is_admin());

create policy radars_owner_all on public.radars for all
using (user_id = public.current_app_user_id() or public.is_admin())
with check (user_id = public.current_app_user_id() or public.is_admin());

create policy scores_owner_select on public.deal_scores for select
using (user_id = public.current_app_user_id() or public.is_admin());
create policy alerts_owner_all on public.alerts for all
using (user_id = public.current_app_user_id() or public.is_admin())
with check (user_id = public.current_app_user_id() or public.is_admin());
create policy saved_owner_all on public.saved_deals for all
using (user_id = public.current_app_user_id() or public.is_admin())
with check (user_id = public.current_app_user_id() or public.is_admin());
create policy seen_owner_all on public.user_seen_products for all
using (user_id = public.current_app_user_id() or public.is_admin())
with check (user_id = public.current_app_user_id() or public.is_admin());
create policy rejected_owner_all on public.rejected_products for all
using (user_id = public.current_app_user_id() or public.is_admin())
with check (user_id = public.current_app_user_id() or public.is_admin());
create policy reminders_owner_all on public.auction_reminders for all
using (user_id = public.current_app_user_id() or public.is_admin())
with check (user_id = public.current_app_user_id() or public.is_admin());
create policy scan_logs_owner_select on public.scan_logs for select
using (user_id = public.current_app_user_id() or public.is_admin());
create policy admin_logs_admin_select on public.admin_logs for select
using (public.is_admin());

create policy products_authenticated_select on public.products for select
using (auth.uid() is not null);
create policy images_authenticated_select on public.product_images for select
using (auth.uid() is not null);
create policy comparables_authenticated_select on public.market_comparables for select
using (auth.uid() is not null);
