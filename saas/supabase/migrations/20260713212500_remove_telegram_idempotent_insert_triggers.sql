-- Replace delete-and-reinsert trigger idempotency with explicit PostgREST
-- conflict targets in the application. This preserves record IDs, notes and
-- original timestamps when a user repeats a Telegram action.

drop trigger if exists saved_deals_idempotent_insert on public.saved_deals;
drop trigger if exists rejected_products_idempotent_insert on public.rejected_products;
drop trigger if exists auction_reminders_idempotent_insert on public.auction_reminders;

drop function if exists public.make_user_product_insert_idempotent();
