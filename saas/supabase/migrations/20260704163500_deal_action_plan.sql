alter table public.deal_scores
  add column if not exists maximum_offer numeric(12,2),
  add column if not exists break_even_resale_price numeric(12,2),
  add column if not exists recommended_channel text,
  add column if not exists estimated_sale_days integer,
  add column if not exists action_plan text;

alter table public.deal_scores drop constraint if exists deal_scores_estimated_sale_days_check;
alter table public.deal_scores add constraint deal_scores_estimated_sale_days_check
check (estimated_sale_days is null or estimated_sale_days between 1 and 3650);
