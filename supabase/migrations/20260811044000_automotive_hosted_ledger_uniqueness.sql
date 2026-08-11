-- Hosted Automotive Staging replay preserved all SQL but produced repeated
-- migration names under generated management-API versions. Do not delete or
-- rewrite executed SQL/version history. Keep the newest row under its logical
-- name and give every older replay row an explicit, version-qualified history
-- name so reconciliation is unambiguous and future audits can identify it.

begin;

create temporary table automotive_ledger_duplicates on commit drop as
select
  version,
  name,
  row_number() over (partition by name order by version desc) as replay_rank
from supabase_migrations.schema_migrations
where name in (
  select name
  from supabase_migrations.schema_migrations
  group by name
  having count(*) > 1
);

do $preflight$
declare
  total_rows integer;
  distinct_names integer;
  duplicate_excess integer;
  duplicate_groups integer;
begin
  select count(*), count(distinct name)
  into total_rows, distinct_names
  from supabase_migrations.schema_migrations;

  duplicate_excess := total_rows - distinct_names;

  select count(*)::integer
  into duplicate_groups
  from (
    select name
    from supabase_migrations.schema_migrations
    group by name
    having count(*) > 1
  ) grouped;

  if total_rows <> 267
     or distinct_names <> 220
     or duplicate_excess <> 47
     or duplicate_groups <> 36 then
    raise exception
      'automotive hosted ledger drifted before reconciliation: rows %, names %, excess %, groups %',
      total_rows, distinct_names, duplicate_excess, duplicate_groups;
  end if;

  if exists (
    select 1
    from automotive_ledger_duplicates
    where replay_rank > 1
      and exists (
        select 1
        from supabase_migrations.schema_migrations existing
        where existing.name =
          'historical_replay_' || automotive_ledger_duplicates.version || '_' || automotive_ledger_duplicates.name
      )
  ) then
    raise exception 'automotive hosted ledger historical replay name collision';
  end if;
end;
$preflight$;

update supabase_migrations.schema_migrations migration
set name =
  'historical_replay_' || migration.version || '_' || migration.name
from automotive_ledger_duplicates duplicate
where migration.version = duplicate.version
  and migration.name = duplicate.name
  and duplicate.replay_rank > 1;

do $verify$
declare
  total_rows integer;
  distinct_names integer;
begin
  select count(*), count(distinct name)
  into total_rows, distinct_names
  from supabase_migrations.schema_migrations;

  if total_rows <> 267 or distinct_names <> 267 then
    raise exception
      'automotive hosted ledger reconciliation changed row count or left duplicate names: rows %, names %',
      total_rows, distinct_names;
  end if;

  if exists (
    select 1
    from supabase_migrations.schema_migrations
    group by name
    having count(*) > 1
  ) then
    raise exception 'automotive hosted ledger still contains duplicate names';
  end if;
end;
$verify$;

commit;
