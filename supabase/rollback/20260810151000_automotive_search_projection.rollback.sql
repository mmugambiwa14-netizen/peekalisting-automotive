begin;

drop function if exists public.public_listing_search_card_page_v2(
  text,text,text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,text,integer,integer,integer,boolean,text,text,uuid,integer
);
drop function if exists private.public_listing_search_card_page_v2(
  text,text,text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,text,integer,integer,integer,boolean,text,text,uuid,integer
);

drop index if exists public.idx_listings_car_attribute_values;
drop index if exists public.idx_car_details_automotive_search;

commit;
