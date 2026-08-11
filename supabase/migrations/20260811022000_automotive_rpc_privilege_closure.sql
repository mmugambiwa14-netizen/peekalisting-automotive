-- Automotive hosted reconciliation closure.
--
-- Timestamped prerequisite migrations can be replayed after numbered RPC
-- hardening and re-introduce browser-executable SECURITY DEFINER functions.
-- Keep implementations private, expose only SECURITY INVOKER wrappers, remove
-- accidental anonymous EXECUTE inherited from historical defaults, and make
-- future function creation least-privilege by default.

create temporary table automotive_rpc_closure_snapshot on commit drop as
select
  p.oid,
  p.proname as function_name,
  p.oid::regprocedure::text as regprocedure_text,
  oidvectortypes(p.proargtypes) as identity_types,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_function_arguments(p.oid) as full_arguments,
  pg_get_function_result(p.oid) as result_type,
  l.lanname as language_name,
  p.provolatile,
  p.proretset,
  p.proisstrict,
  p.proparallel,
  p.procost,
  p.prorows,
  p.pronargs,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname = 'public'
  and p.prokind = 'f'
  and p.prosecdef
  and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  and p.proname <> 'can_publish_in_category';

do $closure$
declare
  target record;
  call_arguments text;
  wrapper_body text;
  volatility_clause text;
  strict_clause text;
  parallel_clause text;
  rows_clause text;
  wrapper_sql text;
begin
  if exists (
    select 1
    from automotive_rpc_closure_snapshot
    where language_name not in ('sql', 'plpgsql')
  ) then
    raise exception 'automotive RPC closure encountered an unsupported function language';
  end if;

  if exists (
    select 1
    from automotive_rpc_closure_snapshot expected
    join pg_proc p
      on p.proname = expected.function_name
     and pg_get_function_identity_arguments(p.oid) = expected.identity_arguments
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
  ) then
    raise exception 'automotive RPC closure found an unexpected private signature collision';
  end if;

  for target in
    select * from automotive_rpc_closure_snapshot
    order by function_name, identity_arguments
  loop
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

    wrapper_sql := format(
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
    execute wrapper_sql;

    execute format(
      'revoke all on function public.%I(%s) from public, anon, authenticated, service_role',
      target.function_name,
      target.identity_types
    );
    execute format(
      'revoke all on function private.%I(%s) from public, anon, authenticated, service_role',
      target.function_name,
      target.identity_types
    );

    -- These are authenticated application/admin APIs. None is anonymous.
    if target.function_name <> 'taxonomy_terms_collide' and target.authenticated_execute then
      execute format('grant execute on function public.%I(%s) to authenticated', target.function_name, target.identity_types);
      execute format('grant execute on function private.%I(%s) to authenticated', target.function_name, target.identity_types);
    end if;
    if target.service_execute then
      execute format('grant execute on function public.%I(%s) to service_role', target.function_name, target.identity_types);
      execute format('grant execute on function private.%I(%s) to service_role', target.function_name, target.identity_types);
    end if;
  end loop;
end;
$closure$;

-- 20260810150000 already created the current automotive implementation. Replace
-- the older public SECURITY DEFINER body from the curated-business foundation
-- with a non-privileged wrapper instead of overwriting that newer logic.
create or replace function public.can_publish_in_category(p_category text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $wrapper$
  select private.can_publish_in_category($1);
$wrapper$;

revoke all on function public.can_publish_in_category(text)
  from public, anon, authenticated, service_role;
revoke all on function private.can_publish_in_category(text)
  from public, anon, authenticated, service_role;
grant execute on function public.can_publish_in_category(text) to authenticated, service_role;
grant execute on function private.can_publish_in_category(text) to authenticated, service_role;

-- The old database default ACL granted EXECUTE directly to anon. Earlier Peek
-- migrations explicitly intended the following RPCs to be authenticated-only,
-- but the named-role default survived `revoke ... from public`.
revoke execute on function public.bind_response_peek(uuid, uuid[]) from anon;
revoke execute on function public.create_peek_request(uuid, uuid, public.peek_request_category, text) from anon;
revoke execute on function public.decline_peek_request(uuid, text) from anon;
revoke execute on function public.disable_web_push_subscription(text) from anon;
revoke execute on function public.merge_peek_request(uuid, uuid) from anon;
revoke execute on function public.my_peek_request_ids(uuid[]) from anon;
revoke execute on function public.owner_listing_contacts(uuid[]) from anon;
revoke execute on function public.owner_service_contacts(uuid[]) from anon;
revoke execute on function public.prepare_own_account_deletion(text) from anon;
revoke execute on function public.queue_response_peek_binding(uuid, uuid) from anon;
revoke execute on function public.register_web_push_subscription(text, text, text, text, text) from anon;
revoke execute on function public.response_peek_request_candidates(uuid) from anon;
revoke execute on function public.reveal_listing_contact(uuid) from anon;
revoke execute on function public.reveal_service_contact(uuid) from anon;
revoke execute on function public.seller_peek_request_queue(bigint, timestamptz, uuid, integer) from anon;
revoke execute on function public.seller_unbound_response_peeks() from anon;
revoke execute on function public.support_peek_request(uuid) from anon;
revoke execute on function public.withdraw_peek_request_support(uuid) from anon;

revoke execute on function private.bind_response_peek(uuid, uuid[]) from anon;
revoke execute on function private.create_peek_request(uuid, uuid, public.peek_request_category, text) from anon;
revoke execute on function private.decline_peek_request(uuid, text) from anon;
revoke execute on function private.disable_web_push_subscription(text) from anon;
revoke execute on function private.merge_peek_request(uuid, uuid) from anon;
revoke execute on function private.my_peek_request_ids(uuid[]) from anon;
revoke execute on function private.owner_listing_contacts(uuid[]) from anon;
revoke execute on function private.owner_service_contacts(uuid[]) from anon;
revoke execute on function private.prepare_own_account_deletion(text) from anon;
revoke execute on function private.queue_response_peek_binding(uuid, uuid) from anon;
revoke execute on function private.register_web_push_subscription(text, text, text, text, text) from anon;
revoke execute on function private.response_peek_request_candidates(uuid) from anon;
revoke execute on function private.reveal_listing_contact(uuid) from anon;
revoke execute on function private.reveal_service_contact(uuid) from anon;
revoke execute on function private.seller_peek_request_queue(bigint, timestamptz, uuid, integer) from anon;
revoke execute on function private.seller_unbound_response_peeks() from anon;
revoke execute on function private.support_peek_request(uuid) from anon;
revoke execute on function private.withdraw_peek_request_support(uuid) from anon;

-- Creation of a new function must not make it browser-callable implicitly.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated;

-- Reassert the table-level RLS bypass closure after replaying timestamped
-- prerequisites that created additional tables.
do $table_privileges$
declare
  target record;
begin
  for target in
    select c.oid::regclass as relation
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format(
      'revoke truncate, trigger, references on %s from anon, authenticated',
      target.relation
    );
    execute format(
      'revoke insert, update, delete on %s from anon',
      target.relation
    );
  end loop;
end;
$table_privileges$;

alter default privileges for role postgres in schema public
  revoke truncate, trigger, references on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke insert, update, delete on tables from anon;

-- Launch gate: only invoker wrappers may remain on the browser-visible public
-- RPC surface.
do $verify$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  ) then
    raise exception 'automotive RPC privilege closure left a browser-executable public SECURITY DEFINER function';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in (
        'bind_response_peek','create_peek_request','decline_peek_request',
        'disable_web_push_subscription','merge_peek_request','my_peek_request_ids',
        'owner_listing_contacts','owner_service_contacts','prepare_own_account_deletion',
        'queue_response_peek_binding','register_web_push_subscription',
        'response_peek_request_candidates','reveal_listing_contact','reveal_service_contact',
        'seller_peek_request_queue','seller_unbound_response_peeks',
        'support_peek_request','withdraw_peek_request_support'
      )
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ) then
    raise exception 'automotive RPC privilege closure left anon access to an authenticated private implementation';
  end if;
end;
$verify$;
