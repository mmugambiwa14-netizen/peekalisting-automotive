-- Preserve every executed migration row while removing ambiguous duplicate names
-- created during hosted replay/reconciliation. Versions and SQL statements are
-- never deleted or rewritten; only noncanonical replay rows receive explicit
-- historical names. Hash predicates make the repair fail closed if the hosted
-- ledger differs from the audited state.

update supabase_migrations.schema_migrations
set name = 'legacy_0102_sub_saharan_location_registry_partial'
where version = '20260810234436'
  and name = '0102_sub_saharan_location_registry'
  and md5(array_to_string(statements, E'\n')) = 'b327e605daea4c3f095513ebaa1e7b6f';

update supabase_migrations.schema_migrations
set name = 'repair_v1_admin_keyset_pagination_replay'
where version = '20260810230747'
  and name = 'v1_admin_keyset_pagination'
  and md5(array_to_string(statements, E'\n')) = '3f27174b8088f116535ed97803b463f8';

update supabase_migrations.schema_migrations
set name = 'repair_v1_trigger_function_grant_closure_replay'
where version = '20260810230851'
  and name = 'v1_trigger_function_grant_closure'
  and md5(array_to_string(statements, E'\n')) = 'aa7f4de6a47b4b79e6248f9808cb5f90';

do $verify$
begin
  if exists (
    select 1
    from supabase_migrations.schema_migrations
    group by name
    having count(*) > 1
  ) then
    raise exception 'automotive migration ledger still contains duplicate names';
  end if;

  if not exists (
    select 1 from supabase_migrations.schema_migrations
    where version = '20260811023931'
      and name = '0102_sub_saharan_location_registry'
      and md5(array_to_string(statements, E'\n')) = '1da15e89db300f17565dc40cca853a75'
  ) then
    raise exception 'canonical 0102 repository replay is not represented in the hosted ledger';
  end if;
end;
$verify$;
