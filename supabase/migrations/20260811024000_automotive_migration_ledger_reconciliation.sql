-- Preserve every executed migration row while removing the specific ambiguous
-- hosted-replay names known from the original Automotive Staging repair.
--
-- This migration is also part of the canonical clean-database chain. A clean
-- database, or a hosted database whose ledger has already been reconciled by a
-- later audited repair, has no duplicate logical names and therefore needs no
-- mutation here. Only an actually ambiguous ledger enters the hash-locked
-- historical repair path below.

do $reconcile$
declare
  row_record record;
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    group by name
    having count(*) > 1
  ) then
    return;
  end if;

  for row_record in
    select *
    from (values
      (
        '20260810234436'::text,
        '0102_sub_saharan_location_registry'::text,
        'legacy_0102_sub_saharan_location_registry_partial'::text,
        'b327e605daea4c3f095513ebaa1e7b6f'::text
      ),
      (
        '20260810230747',
        'v1_admin_keyset_pagination',
        'repair_v1_admin_keyset_pagination_replay',
        '3f27174b8088f116535ed97803b463f8'
      ),
      (
        '20260810230851',
        'v1_trigger_function_grant_closure',
        'repair_v1_trigger_function_grant_closure_replay',
        'aa7f4de6a47b4b79e6248f9808cb5f90'
      )
    ) as expected(version, original_name, historical_name, statement_md5)
  loop
    if exists (
      select 1
      from supabase_migrations.schema_migrations migration
      where migration.version = row_record.version
        and migration.name = row_record.historical_name
    ) then
      continue;
    end if;

    if exists (
      select 1
      from supabase_migrations.schema_migrations migration
      where migration.version = row_record.version
        and migration.name = row_record.original_name
    ) then
      if not exists (
        select 1
        from supabase_migrations.schema_migrations migration
        where migration.version = row_record.version
          and migration.name = row_record.original_name
          and md5(array_to_string(migration.statements, E'\n')) = row_record.statement_md5
      ) then
        raise exception
          'automotive migration ledger row % drifted from the audited replay state',
          row_record.version;
      end if;

      update supabase_migrations.schema_migrations migration
      set name = row_record.historical_name
      where migration.version = row_record.version
        and migration.name = row_record.original_name
        and md5(array_to_string(migration.statements, E'\n')) = row_record.statement_md5;
    end if;
  end loop;

  if exists (
    select 1
    from supabase_migrations.schema_migrations
    group by name
    having count(*) > 1
  ) then
    raise exception 'automotive migration ledger still contains duplicate names';
  end if;
end;
$reconcile$;
