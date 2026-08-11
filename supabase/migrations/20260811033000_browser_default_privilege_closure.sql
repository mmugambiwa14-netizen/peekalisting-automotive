-- Close the remaining browser privilege paths on Automotive Staging.
--
-- Application migrations and all application objects in public/private are
-- owned by postgres. Supabase also carries platform-owned default ACLs for
-- supabase_admin, but the project migration role cannot alter that superuser's
-- defaults. Fail closed by asserting the app ownership boundary, hardening all
-- live app objects, and hardening postgres defaults for every future app
-- migration.

begin;

-- Application objects must stay under the migration owner whose defaults this
-- repository controls. A different owner would bypass the guarantees below.
do $owners$
declare
  bad_relations integer;
  bad_functions integer;
begin
  select count(*)::integer into bad_relations
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public','private')
    and c.relkind in ('r','p','S','v','m')
    and pg_get_userbyid(c.relowner) <> 'postgres';

  if bad_relations <> 0 then
    raise exception 'application relation ownership drift detected: % non-postgres objects', bad_relations;
  end if;

  select count(*)::integer into bad_functions
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public','private')
    and pg_get_userbyid(p.proowner) <> 'postgres';

  if bad_functions <> 0 then
    raise exception 'application function ownership drift detected: % non-postgres functions', bad_functions;
  end if;
end;
$owners$;

-- Existing public tables: no browser role may hold privileges that bypass or
-- materially interfere with row-level application authorization.
do $tables$
declare
  target record;
begin
  for target in
    select c.oid::regclass as relation
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r','p')
  loop
    execute format(
      'revoke truncate, trigger, references, maintain on %s from anon, authenticated',
      target.relation
    );
    -- Anonymous writes are not part of the curated automotive launch surface.
    execute format(
      'revoke insert, update, delete on %s from anon',
      target.relation
    );
  end loop;
end;
$tables$;

-- Existing sequences: UPDATE permits setval() and therefore sequence-state
-- manipulation. Authenticated keeps USAGE so explicitly granted serial-backed
-- inserts continue to work; anon needs neither write nor nextval access.
do $sequences$
declare
  target record;
begin
  for target in
    select c.oid::regclass as relation
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'S'
  loop
    execute format('revoke update on sequence %s from anon, authenticated', target.relation);
    execute format('revoke usage on sequence %s from anon', target.relation);
  end loop;
end;
$sequences$;

-- Future postgres-owned tables.
alter default privileges for role postgres in schema public
  revoke truncate, trigger, references, maintain on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke insert, update, delete on tables from anon;

-- Future postgres-owned sequences. Prevent setval() from browser roles and
-- anonymous nextval() access while preserving authenticated USAGE.
alter default privileges for role postgres in schema public
  revoke update on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage on sequences from anon;

-- PostgreSQL's built-in function default grants EXECUTE to PUBLIC globally.
-- A schema-local REVOKE cannot remove that hard-wired global default, so close
-- PUBLIC globally for postgres-owned functions, then also clear any explicit
-- browser grants attached to the two application schemas.
alter default privileges for role postgres
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
alter default privileges for role postgres in schema private
  revoke execute on functions from anon, authenticated;

-- Fail closed if any live object still exposes a bypassing browser privilege.
do $verify_live$
declare
  bad_tables integer;
  bad_anon_writes integer;
  bad_anon_sequences integer;
  bad_auth_sequence_updates integer;
begin
  select count(*)::integer into bad_tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r','p')
    and (
      has_table_privilege('anon', c.oid, 'TRUNCATE')
      or has_table_privilege('authenticated', c.oid, 'TRUNCATE')
      or has_table_privilege('anon', c.oid, 'TRIGGER')
      or has_table_privilege('authenticated', c.oid, 'TRIGGER')
      or has_table_privilege('anon', c.oid, 'REFERENCES')
      or has_table_privilege('authenticated', c.oid, 'REFERENCES')
      or has_table_privilege('anon', c.oid, 'MAINTAIN')
      or has_table_privilege('authenticated', c.oid, 'MAINTAIN')
    );

  if bad_tables <> 0 then
    raise exception 'browser bypass/maintenance privileges remain on % public tables', bad_tables;
  end if;

  select count(*)::integer into bad_anon_writes
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r','p')
    and (
      has_table_privilege('anon', c.oid, 'INSERT')
      or has_table_privilege('anon', c.oid, 'UPDATE')
      or has_table_privilege('anon', c.oid, 'DELETE')
    );

  if bad_anon_writes <> 0 then
    raise exception 'anonymous DML remains on % public tables', bad_anon_writes;
  end if;

  select count(*)::integer into bad_anon_sequences
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'S'
    and (
      has_sequence_privilege('anon', format('%I.%I', n.nspname, c.relname), 'UPDATE')
      or has_sequence_privilege('anon', format('%I.%I', n.nspname, c.relname), 'USAGE')
    );

  if bad_anon_sequences <> 0 then
    raise exception 'anonymous sequence write/usage remains on % public sequences', bad_anon_sequences;
  end if;

  select count(*)::integer into bad_auth_sequence_updates
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'S'
    and has_sequence_privilege('authenticated', format('%I.%I', n.nspname, c.relname), 'UPDATE');

  if bad_auth_sequence_updates <> 0 then
    raise exception 'authenticated sequence UPDATE remains on % public sequences', bad_auth_sequence_updates;
  end if;
end;
$verify_live$;

-- Verify postgres defaults cannot recreate the same browser exposure.
do $verify_defaults$
declare
  bad_defaults integer;
  global_function_acl_closed boolean;
begin
  select count(*)::integer into bad_defaults
  from pg_default_acl d
  left join pg_namespace n on n.oid = d.defaclnamespace
  cross join lateral aclexplode(d.defaclacl) x
  left join pg_roles grantee on grantee.oid = x.grantee
  where pg_get_userbyid(d.defaclrole) = 'postgres'
    and (
      (d.defaclobjtype = 'r'
        and n.nspname = 'public'
        and grantee.rolname in ('anon','authenticated')
        and x.privilege_type in ('TRUNCATE','TRIGGER','REFERENCES','MAINTAIN'))
      or (d.defaclobjtype = 'r'
        and n.nspname = 'public'
        and grantee.rolname = 'anon'
        and x.privilege_type in ('INSERT','UPDATE','DELETE'))
      or (d.defaclobjtype = 'S'
        and n.nspname = 'public'
        and grantee.rolname in ('anon','authenticated')
        and x.privilege_type = 'UPDATE')
      or (d.defaclobjtype = 'S'
        and n.nspname = 'public'
        and grantee.rolname = 'anon'
        and x.privilege_type = 'USAGE')
      or (d.defaclobjtype = 'f'
        and (d.defaclnamespace = 0 or n.nspname in ('public','private'))
        and coalesce(grantee.rolname, 'PUBLIC') in ('PUBLIC','anon','authenticated')
        and x.privilege_type = 'EXECUTE')
    );

  if bad_defaults <> 0 then
    raise exception 'unsafe postgres browser default ACL entries remain: %', bad_defaults;
  end if;

  select exists (
    select 1
    from pg_default_acl d
    where pg_get_userbyid(d.defaclrole) = 'postgres'
      and d.defaclnamespace = 0
      and d.defaclobjtype = 'f'
      and not exists (
        select 1
        from aclexplode(d.defaclacl) x
        left join pg_roles grantee on grantee.oid = x.grantee
        where coalesce(grantee.rolname, 'PUBLIC') in ('PUBLIC','anon','authenticated')
          and x.privilege_type = 'EXECUTE'
      )
  ) into global_function_acl_closed;

  if not global_function_acl_closed then
    raise exception 'global postgres function default EXECUTE is not fail-closed';
  end if;
end;
$verify_defaults$;

commit;
