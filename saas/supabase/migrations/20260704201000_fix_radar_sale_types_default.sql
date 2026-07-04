alter table public.radars
  alter column sale_types set default array['BUY_NOW','AUCTION']::text[];

alter table public.radars
  alter column sources set default array['ebay']::text[];
