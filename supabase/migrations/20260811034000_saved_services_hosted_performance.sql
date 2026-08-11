-- Optimize the hosted saved-services launch path without changing its
-- authorization contract. Each policy keeps the same active-user/owner rules;
-- only auth.uid() is initialized once per statement, and service_id receives a
-- covering index for its ON DELETE CASCADE foreign key.

begin;

create index if not exists idx_saved_services_service_id
  on public.saved_services(service_id);

drop policy if exists saved_services_owner_read on public.saved_services;
create policy saved_services_owner_read
  on public.saved_services
  for select to authenticated
  using (
    public.is_active_user()
    and user_id = (select auth.uid())
  );

drop policy if exists saved_services_owner_insert on public.saved_services;
create policy saved_services_owner_insert
  on public.saved_services
  for insert to authenticated
  with check (
    public.is_active_user()
    and user_id = (select auth.uid())
    and exists (
      select 1
      from public.services
      where services.id = saved_services.service_id
        and services.status = 'active'::public.service_status
        and services.category <> 'legal'::public.service_category
    )
  );

drop policy if exists saved_services_owner_delete on public.saved_services;
create policy saved_services_owner_delete
  on public.saved_services
  for delete to authenticated
  using (
    public.is_active_user()
    and user_id = (select auth.uid())
  );

do $verify$
declare
  policy_count integer;
  wrong_roles integer;
  direct_uid_forms integer;
begin
  if to_regclass('public.idx_saved_services_service_id') is null then
    raise exception 'saved_services service_id covering index is missing';
  end if;

  select count(*)::integer into policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'saved_services'
    and policyname in (
      'saved_services_owner_read',
      'saved_services_owner_insert',
      'saved_services_owner_delete'
    );

  if policy_count <> 3 then
    raise exception 'saved_services policy set is incomplete: %/3', policy_count;
  end if;

  select count(*)::integer into wrong_roles
  from pg_policies
  where schemaname = 'public'
    and tablename = 'saved_services'
    and policyname in (
      'saved_services_owner_read',
      'saved_services_owner_insert',
      'saved_services_owner_delete'
    )
    and roles <> array['authenticated']::name[];

  if wrong_roles <> 0 then
    raise exception 'saved_services policy role contract drifted';
  end if;

  -- PostgreSQL renders the optimized form as a scalar subquery around
  -- auth.uid(). Reject the old direct predicate shape specifically.
  select count(*)::integer into direct_uid_forms
  from pg_policies
  where schemaname = 'public'
    and tablename = 'saved_services'
    and policyname in (
      'saved_services_owner_read',
      'saved_services_owner_insert',
      'saved_services_owner_delete'
    )
    and (
      coalesce(qual, '') ~ 'user_id = auth\\.uid\\(\\)'
      or coalesce(with_check, '') ~ 'user_id = auth\\.uid\\(\\)'
    );

  if direct_uid_forms <> 0 then
    raise exception 'saved_services still contains direct per-row auth.uid() owner predicates';
  end if;
end;
$verify$;

commit;
