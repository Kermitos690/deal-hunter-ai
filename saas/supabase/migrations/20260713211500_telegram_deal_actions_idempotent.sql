-- Make Telegram deal actions idempotent for existing production code.
--
-- The bot currently uses PostgREST upsert() without an explicit onConflict
-- target for saved_deals, rejected_products and auction_reminders. PostgreSQL
-- then defaults to the primary key while these tables are functionally unique
-- on (user_id, product_id). Repeating an action can therefore raise a unique
-- violation and surface as "Action impossible" in Telegram.
--
-- These BEFORE INSERT triggers safely replace the caller's existing row before
-- the insert. The function is SECURITY INVOKER so RLS remains enforced for
-- authenticated callers; the server service role continues to work normally.

create or replace function public.make_user_product_insert_idempotent()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_table_name = 'saved_deals' then
    delete from public.saved_deals
    where user_id = new.user_id
      and product_id = new.product_id;
  elsif tg_table_name = 'rejected_products' then
    delete from public.rejected_products
    where user_id = new.user_id
      and product_id = new.product_id;
  elsif tg_table_name = 'auction_reminders' then
    delete from public.auction_reminders
    where user_id = new.user_id
      and product_id = new.product_id;
  else
    raise exception 'Unsupported idempotent insert table: %', tg_table_name;
  end if;

  return new;
end;
$$;

drop trigger if exists saved_deals_idempotent_insert on public.saved_deals;
create trigger saved_deals_idempotent_insert
before insert on public.saved_deals
for each row execute function public.make_user_product_insert_idempotent();

drop trigger if exists rejected_products_idempotent_insert on public.rejected_products;
create trigger rejected_products_idempotent_insert
before insert on public.rejected_products
for each row execute function public.make_user_product_insert_idempotent();

drop trigger if exists auction_reminders_idempotent_insert on public.auction_reminders;
create trigger auction_reminders_idempotent_insert
before insert on public.auction_reminders
for each row execute function public.make_user_product_insert_idempotent();

revoke all on function public.make_user_product_insert_idempotent() from public;
revoke all on function public.make_user_product_insert_idempotent() from anon;
revoke all on function public.make_user_product_insert_idempotent() from authenticated;
grant execute on function public.make_user_product_insert_idempotent() to service_role;
