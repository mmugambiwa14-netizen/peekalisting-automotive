begin;

-- Business approval and public profile creation are deliberately separate
-- capabilities. Approval triggers already synchronize profiles that exist at
-- review time; this closes the reverse ordering so a profile created after an
-- approval receives the same server-owned verification state immediately.
create or replace function private.sync_business_profile_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application_id uuid;
begin
  select application.id
  into v_application_id
  from public.business_applications application
  where application.user_id = new.user_id
  order by application.submitted_at desc, application.id desc
  limit 1;

  if v_application_id is not null then
    perform public.sync_business_profile_verification(v_application_id);
  end if;

  return new;
end;
$$;

revoke all on function private.sync_business_profile_after_insert()
  from public, anon, authenticated, service_role;

drop trigger if exists sync_business_profile_after_insert on public.business_profiles;
create trigger sync_business_profile_after_insert
after insert on public.business_profiles
for each row execute function private.sync_business_profile_after_insert();

comment on function private.sync_business_profile_after_insert() is
  'Synchronizes server-controlled business verification when a public profile is created after the owner already has a reviewed business application.';

commit;
