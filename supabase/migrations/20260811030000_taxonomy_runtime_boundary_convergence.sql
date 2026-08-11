-- Converge taxonomy RPCs after restores or partial hosted migration replays.
-- Fresh databases already pass through the original taxonomy hardening chain;
-- this migration is deliberately idempotent against that healthy end state.

begin;

-- Public SECURITY INVOKER wrappers resolve pre-bound private implementations,
-- so PostgREST roles need USAGE but never CREATE on the non-exposed schema.
grant usage on schema private to anon, authenticated;
revoke create on schema private from public, anon, authenticated;

-- Constraint/trigger helpers are not browser RPCs.
revoke all on function public.is_valid_taxonomy_aliases(text[]) from public, anon, authenticated;
revoke all on function public.is_valid_taxonomy_synonyms(text[]) from public, anon, authenticated;
revoke all on function public.is_valid_taxonomy_markets(text[]) from public, anon, authenticated;
revoke all on function public.is_valid_localized_taxonomy_labels(jsonb) from public, anon, authenticated;
grant execute on function public.is_valid_taxonomy_aliases(text[]) to service_role;
grant execute on function public.is_valid_taxonomy_synonyms(text[]) to service_role;
grant execute on function public.is_valid_taxonomy_markets(text[]) to service_role;
grant execute on function public.is_valid_localized_taxonomy_labels(jsonb) to service_role;

revoke all on function public.enforce_listing_taxonomy_category() from public, anon, authenticated;
revoke all on function public.enforce_taxonomy_hierarchy_integrity() from public, anon, authenticated;
grant execute on function public.enforce_listing_taxonomy_category() to service_role;
grant execute on function public.enforce_taxonomy_hierarchy_integrity() to service_role;

-- Internal collision detection remains callable only by its owner/privileged
-- implementation path, not by PostgREST roles.
revoke all on function public.taxonomy_terms_collide(text, uuid, text, text, text[])
  from public, anon, authenticated, service_role;

-- Buyer taxonomy reads stay public through the intended projection only.
revoke all on function public.public_category_taxonomy(text) from public, service_role;
grant execute on function public.public_category_taxonomy(text) to anon, authenticated;
revoke all on function public.public_category_taxonomy_v2(text, text) from public, service_role;
grant execute on function public.public_category_taxonomy_v2(text, text) to anon, authenticated;
revoke all on function public.resolve_category_taxonomy(text, text) from public, service_role;
grant execute on function public.resolve_category_taxonomy(text, text) to anon, authenticated;
revoke all on function public.resolve_category_taxonomy(text, text, text) from public, service_role;
grant execute on function public.resolve_category_taxonomy(text, text, text) to anon, authenticated;

-- A restored/partially replayed database can contain the V2 admin functions as
-- public SECURITY DEFINER implementations even though the canonical chain moves
-- them into private. Snapshot only that drift; on a fresh database this table is
-- empty and the already-correct wrappers are simply re-validated below.
create temporary table taxonomy_v2_public_definers on commit drop as
select
  p.oid,
  p.proname as function_name,
  p.oid::regprocedure::text as regprocedure_text,
  oidvectortypes(p.proargtypes) as identity_types,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_function_arguments(p.oid) as full_arguments,
  pg_get_function_result(p.oid) as result_type,
  p.provolatile,
  p.proretset,
  p.proisstrict,
  p.proparallel,
  p.procost,
  p.prorows,
  p.pronargs
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and p.prosecdef
  and p.proname in (
    'admin_taxonomy_rows_v2',
    'admin_add_taxonomy_node_v2',
    'admin_update_taxonomy_node_v2'
  );

do $move$
declare
  target record;
  call_arguments text;
  volatility_clause text;
  strict_clause text;
  parallel_clause text;
  rows_clause text;
  wrapper_body text;
begin
  for target in
    select * from taxonomy_v2_public_definers
    order by function_name, identity_arguments
  loop
    if exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'private'
        and p.proname = target.function_name
        and pg_get_function_identity_arguments(p.oid) = target.identity_arguments
    ) then
      raise exception 'taxonomy private implementation already exists while public definer remains: %(%)',
        target.function_name, target.identity_arguments;
    end if;

    select coalesce(string_agg('$' || position::text, ', ' order by position), '')
      into call_arguments
    from generate_series(1, target.pronargs) as generated(position);

    volatility_clause := case target.provolatile
      when 'i' then 'immutable'
      when 's' then 'stable'
      else 'volatile'
    end;
    strict_clause := case when target.proisstrict then 'strict' else 'called on null input' end;
    parallel_clause := case target.proparallel
      when 's' then 'parallel safe'
      when 'r' then 'parallel restricted'
      else 'parallel unsafe'
    end;
    rows_clause := case when target.proretset then format('rows %s', target.prorows) else '' end;
    wrapper_body := case
      when target.proretset then format('select * from private.%I(%s);', target.function_name, call_arguments)
      else format('select private.%I(%s);', target.function_name, call_arguments)
    end;

    execute format('alter function %s set schema private', target.regprocedure_text);
    execute format(
      'create function public.%I(%s) returns %s language sql %s %s security invoker %s cost %s %s set search_path = '''' as $wrapper$%s$wrapper$',
      target.function_name,
      target.full_arguments,
      target.result_type,
      volatility_clause,
      strict_clause,
      parallel_clause,
      target.procost,
      rows_clause,
      wrapper_body
    );
  end loop;
end;
$move$;

-- Normalize the final V2 admin capability regardless of whether this migration
-- moved a drifted implementation or found an already-correct wrapper pair.
do $grants$
declare
  target record;
begin
  for target in
    select p.proname, oidvectortypes(p.proargtypes) as identity_types
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'admin_taxonomy_rows_v2',
        'admin_add_taxonomy_node_v2',
        'admin_update_taxonomy_node_v2'
      )
  loop
    execute format('revoke all on function public.%I(%s) from public, anon, authenticated, service_role', target.proname, target.identity_types);
    execute format('grant execute on function public.%I(%s) to authenticated', target.proname, target.identity_types);
  end loop;

  for target in
    select p.proname, oidvectortypes(p.proargtypes) as identity_types
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in (
        'admin_taxonomy_rows_v2',
        'admin_add_taxonomy_node_v2',
        'admin_update_taxonomy_node_v2'
      )
  loop
    execute format('revoke all on function private.%I(%s) from public, anon, authenticated, service_role', target.proname, target.identity_types);
    execute format('grant execute on function private.%I(%s) to authenticated', target.proname, target.identity_types);
  end loop;
end;
$grants$;

do $verify$
declare
  public_execute_count integer;
  pair_count integer;
begin
  if not has_schema_privilege('anon', 'private', 'USAGE')
     or not has_schema_privilege('authenticated', 'private', 'USAGE')
     or has_schema_privilege('anon', 'private', 'CREATE')
     or has_schema_privilege('authenticated', 'private', 'CREATE') then
    raise exception 'private schema wrapper boundary is invalid';
  end if;

  select count(*)::integer into public_execute_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) privilege
  where n.nspname = 'public'
    and p.proname in (
      'is_valid_taxonomy_aliases',
      'is_valid_taxonomy_synonyms',
      'is_valid_taxonomy_markets',
      'is_valid_localized_taxonomy_labels',
      'enforce_listing_taxonomy_category',
      'enforce_taxonomy_hierarchy_integrity',
      'taxonomy_terms_collide',
      'public_category_taxonomy',
      'public_category_taxonomy_v2',
      'resolve_category_taxonomy',
      'admin_taxonomy_rows_v2',
      'admin_add_taxonomy_node_v2',
      'admin_update_taxonomy_node_v2'
    )
    and privilege.grantee = 0
    and privilege.privilege_type = 'EXECUTE';

  if public_execute_count <> 0 then
    raise exception 'taxonomy PUBLIC EXECUTE grants remain: %', public_execute_count;
  end if;

  select count(*)::integer into pair_count
  from pg_proc wrapper
  join pg_namespace wrapper_schema on wrapper_schema.oid = wrapper.pronamespace
  join pg_proc implementation
    on implementation.proname = wrapper.proname
   and pg_get_function_identity_arguments(implementation.oid) = pg_get_function_identity_arguments(wrapper.oid)
  join pg_namespace implementation_schema on implementation_schema.oid = implementation.pronamespace
  where wrapper_schema.nspname = 'public'
    and implementation_schema.nspname = 'private'
    and wrapper.proname in (
      'admin_taxonomy_rows_v2',
      'admin_add_taxonomy_node_v2',
      'admin_update_taxonomy_node_v2'
    )
    and not wrapper.prosecdef
    and implementation.prosecdef
    and wrapper.proconfig = array['search_path=""']::text[]
    and has_function_privilege('authenticated', wrapper.oid, 'EXECUTE')
    and not has_function_privilege('anon', wrapper.oid, 'EXECUTE')
    and not has_function_privilege('service_role', wrapper.oid, 'EXECUTE');

  if pair_count <> 3 then
    raise exception 'taxonomy V2 admin wrapper boundary did not converge: % pairs', pair_count;
  end if;
end;
$verify$;

commit;
