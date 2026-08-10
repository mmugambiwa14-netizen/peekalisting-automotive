begin;

drop trigger if exists sync_business_profile_after_insert on public.business_profiles;
drop function if exists private.sync_business_profile_after_insert();

commit;
