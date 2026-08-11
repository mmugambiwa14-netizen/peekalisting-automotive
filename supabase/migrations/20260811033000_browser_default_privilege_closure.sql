-- Close the remaining browser privilege paths on Automotive Staging.
--
-- Earlier hardening covered TRUNCATE/TRIGGER/REFERENCES for objects/defaults
-- created by postgres, but Supabase also carries defaults owned by
-- supabase_admin. PostgreSQL's MAINTAIN table privilege and sequence UPDATE
-- were also left browser-accessible. Keep browser DML behind explicit RLS/
-- grants, prevent maintenance/RLS-bypassing operations, and make future RPCs
-- fail closed unless a migration grants EXECUTE deliberately.

begin;

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

-- Future tables. Cover both grantors used by hosted Supabase migrations.
alter default privileges for role postgres in schema public
  revoke truncate, trigger, references, maintain on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke insert, update, delete on tables from anon;

alter default privileges for role supabase_admin in schema public
  revoke truncate, trigger, references, maintain on tables from anon, authenticated;
alter default privileges for role supabase_admin in schema public
  revoke insert, update, delete on tables from anon;

-- Future sequences: prevent setval() from browser roles and prevent anonymous
-- nextval() access while preserving authenticated USAGE where explicitly
-- inherited by the hosted defaults.
alter default privileges for role postgres in schema public
  revoke update on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage on sequences from anon;
alter default privileges for role supabase_admin in schema public
  revoke update on sequences from anon, authenticated;
alter default privileges for role supabase_admin in schema public
  revoke usage on sequences from anon;

-- Future functions must never become browser-callable implicitly. Application
-- RPC migrations must grant the exact wrapper/role surface they intend.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role supabase_admin in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role supabase_admin in schema private
  revoke execute on functions from public, anon, authenticated;

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
      has_sequence_privilege('anon', c.oid, 'UPDATE')
      or has_sequence_privilege('anon', c.oid, 'USAGE')
    );

  if bad_anon_sequences <> 0 then
    raise exception 'anonymous sequence write/usage remains on % public sequences', bad_anon_sequences;
  end if;

  select count(*)::integer into bad_auth_sequence_updates
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'S'
    and has_sequence_privilege('authenticated', c.oid, 'UPDATE');

  if bad_auth_sequence_updates <> 0 then
    raise exception 'authenticated sequence UPDATE remains on % public sequences', bad_auth_sequence_updates;
  end if;
end;
$verify_live$;

-- Verify the two hosted migration owners cannot recreate the same defaults.
do $verify_defaults$
declare
  bad_defaults integer;
  missing_function_acl integer;
begin
  select count(*)::integer into bad_defaults
  from pg_default_acl d
  left join pg_namespace n on n.oid = d.defaclnamespace
  cross join lateral aclexplode(d.defaclacl) x
  left join pg_roles grantee on grantee.oid = x.grantee
  where pg_get_userbyid(d.defaclrole) in ('postgres','supabase_admin')
    and n.nspname in ('public','private')
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
        and coalesce(grantee.rolname, 'PUBLIC') in ('PUBLIC','anon','authenticated')
        and x.privilege_type = 'EXECUTE')
    );

  if bad_defaults <> 0 then
    raise exception 'unsafe browser default ACL entries remain: %', bad_defaults;
  end if;

  -- PostgreSQL gives new functions EXECUTE to PUBLIC unless ALTER DEFAULT
  -- PRIVILEGES creates an explicit ACL. Require an f-row for both owners and
  -- both application schemas so absence cannot silently mean the built-in
  -- permissive default.
  select count(*)::integer into missing_function_acl
  from (values
    ('postgres','public'),
    ('postgres','private'),
    ('supabase_admin','public'),
    ('supabase_admin','private')
  ) expected(owner_name, schema_name)
  where not exists (
    select 1
    from pg_default_acl d
    join pg_namespace n on n.oid = d.defaclnamespace
    where pg_get_userbyid(d.defaclrole) = expected.owner_name
      and n.nspname = expected.schema_name
      and d.defaclobjtype = 'f'
  );

  if missing_function_acl <> 0 then
    raise exception 'function default ACL closure missing for % owner/schema pairs', missing_function_acl;
  end if;
end;
$verify_defaults$;

commit;
