begin;

drop function if exists public.public_automotive_dealers_page(text,timestamptz,uuid,integer);
drop function if exists private.public_automotive_dealers_page(text,timestamptz,uuid,integer);

commit;
