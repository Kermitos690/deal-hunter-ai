update public.radars
set brands = array['Prada','Louis Vuitton','Fendi','Gucci','Hermès']
where cardinality(brands) = 1
  and brands[1] ilike '%Prada%Louis Vuitton%FENDI%Gucci%Hermes%';

update public.radars
set brands = array['Omega','TAG Heuer','Rolex','Tissot']
where cardinality(brands) = 1
  and brands[1] ilike '%Omega%TAG Heuer%Rolex%Tissot%';
