-- Timestamped replay can recreate authenticated-only Peek RPC grants after the
-- general RPC closure. Revoke both direct anon and inherited PUBLIC EXECUTE on
-- every authenticated-only public wrapper/private implementation, then extend
-- the hosted automotive release attestation so this drift cannot pass again.

begin;

do $revoke_authenticated_only$
declare
  target record;
begin
  for target in
    select p.oid::regprocedure as signature
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','private')
      and p.proname in (
        'bind_response_peek',
        'create_peek_request',
        'decline_peek_request',
        'disable_web_push_subscription',
        'merge_peek_request',
        'my_peek_request_ids',
        'owner_listing_contacts',
        'owner_service_contacts',
        'prepare_own_account_deletion',
        'queue_response_peek_binding',
        'register_web_push_subscription',
        'response_peek_request_candidates',
        'reveal_listing_contact',
        'reveal_service_contact',
        'seller_peek_request_queue',
        'seller_unbound_response_peeks',
        'support_peek_request',
        'withdraw_peek_request_support'
      )
  loop
    execute format('revoke execute on function %s from public, anon', target.signature);
  end loop;
end;
$revoke_authenticated_only$;

create or replace function public.automotive_release_boundary_ready()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    -- Browser roles must never execute a privileged public implementation directly.
    not exists (
      select 1
      from pg_catalog.pg_proc function_record
      join pg_catalog.pg_namespace function_schema
        on function_schema.oid = function_record.pronamespace
      where function_schema.nspname = 'public'
        and function_record.prosecdef
        and (
          pg_catalog.has_function_privilege('anon', function_record.oid, 'EXECUTE')
          or pg_catalog.has_function_privilege('authenticated', function_record.oid, 'EXECUTE')
        )
    )

    -- Authenticated-only RPCs must not be executable by anon in either the
    -- public wrapper schema or the private privileged implementation schema.
    and not exists (
      select 1
      from pg_catalog.pg_proc function_record
      join pg_catalog.pg_namespace function_schema
        on function_schema.oid = function_record.pronamespace
      where function_schema.nspname in ('public','private')
        and function_record.proname in (
          'bind_response_peek',
          'create_peek_request',
          'decline_peek_request',
          'disable_web_push_subscription',
          'merge_peek_request',
          'my_peek_request_ids',
          'owner_listing_contacts',
          'owner_service_contacts',
          'prepare_own_account_deletion',
          'queue_response_peek_binding',
          'register_web_push_subscription',
          'response_peek_request_candidates',
          'reveal_listing_contact',
          'reveal_service_contact',
          'seller_peek_request_queue',
          'seller_unbound_response_peeks',
          'support_peek_request',
          'withdraw_peek_request_support'
        )
        and pg_catalog.has_function_privilege('anon', function_record.oid, 'EXECUTE')
    )

    -- Every public table/partition remains behind RLS.
    and not exists (
      select 1
      from pg_catalog.pg_class relation
      join pg_catalog.pg_namespace relation_schema
        on relation_schema.oid = relation.relnamespace
      where relation_schema.nspname = 'public'
        and relation.relkind in ('r', 'p')
        and not relation.relrowsecurity
    )

    -- Browser roles never receive relation-maintenance / DDL-adjacent powers.
    and not exists (
      select 1
      from pg_catalog.pg_class relation
      join pg_catalog.pg_namespace relation_schema
        on relation_schema.oid = relation.relnamespace
      where relation_schema.nspname = 'public'
        and relation.relkind in ('r', 'p')
        and (
          pg_catalog.has_table_privilege('anon', relation.oid, 'TRUNCATE')
          or pg_catalog.has_table_privilege('anon', relation.oid, 'REFERENCES')
          or pg_catalog.has_table_privilege('anon', relation.oid, 'TRIGGER')
          or pg_catalog.has_table_privilege('anon', relation.oid, 'MAINTAIN')
          or pg_catalog.has_table_privilege('authenticated', relation.oid, 'TRUNCATE')
          or pg_catalog.has_table_privilege('authenticated', relation.oid, 'REFERENCES')
          or pg_catalog.has_table_privilege('authenticated', relation.oid, 'TRIGGER')
          or pg_catalog.has_table_privilege('authenticated', relation.oid, 'MAINTAIN')
        )
    )

    -- Raw seller/provider contacts are never directly browser-readable.
    and not pg_catalog.has_column_privilege('anon', 'public.listings', 'contact_phone', 'SELECT')
    and not pg_catalog.has_column_privilege('anon', 'public.listings', 'contact_whatsapp', 'SELECT')
    and not pg_catalog.has_column_privilege('anon', 'public.listings', 'contact_email', 'SELECT')
    and not pg_catalog.has_column_privilege('authenticated', 'public.listings', 'contact_phone', 'SELECT')
    and not pg_catalog.has_column_privilege('authenticated', 'public.listings', 'contact_whatsapp', 'SELECT')
    and not pg_catalog.has_column_privilege('authenticated', 'public.listings', 'contact_email', 'SELECT')
    and not pg_catalog.has_column_privilege('anon', 'public.services', 'contact_phone', 'SELECT')
    and not pg_catalog.has_column_privilege('anon', 'public.services', 'contact_whatsapp', 'SELECT')
    and not pg_catalog.has_column_privilege('anon', 'public.services', 'contact_email', 'SELECT')
    and not pg_catalog.has_column_privilege('authenticated', 'public.services', 'contact_phone', 'SELECT')
    and not pg_catalog.has_column_privilege('authenticated', 'public.services', 'contact_whatsapp', 'SELECT')
    and not pg_catalog.has_column_privilege('authenticated', 'public.services', 'contact_email', 'SELECT')

    -- Legacy convenience relations must not re-expose listing contacts.
    and not pg_catalog.has_column_privilege('anon', 'public.cars', 'contact_phone', 'SELECT')
    and not pg_catalog.has_column_privilege('authenticated', 'public.cars', 'contact_phone', 'SELECT')
    and not pg_catalog.has_column_privilege('anon', 'public.properties', 'contact_phone', 'SELECT')
    and not pg_catalog.has_column_privilege('authenticated', 'public.properties', 'contact_phone', 'SELECT')
    and not pg_catalog.has_column_privilege('anon', 'public.machinery', 'contact_phone', 'SELECT')
    and not pg_catalog.has_column_privilege('authenticated', 'public.machinery', 'contact_phone', 'SELECT')

    -- Future public DDL is fail-closed even when platform-owned default ACLs are broad.
    and exists (
      select 1
      from pg_catalog.pg_event_trigger event_trigger
      where event_trigger.evtname = 'automotive_public_browser_acl_guard'
        and event_trigger.evtenabled <> 'D'
    )

    -- Launch-critical automotive/Peek schema must be present.
    and pg_catalog.to_regclass('public.business_category_approvals') is not null
    and pg_catalog.to_regclass('public.peek_requests') is not null
    and pg_catalog.to_regclass('public.peek_request_fulfilments') is not null
    and pg_catalog.to_regclass('public.saved_services') is not null
    and pg_catalog.to_regclass('public.web_push_notification_preferences') is not null
    and exists (
      select 1
      from pg_catalog.pg_proc function_record
      join pg_catalog.pg_namespace function_schema
        on function_schema.oid = function_record.pronamespace
      where function_schema.nspname = 'public'
        and function_record.proname = 'public_listing_search_card_page_v3'
        and not function_record.prosecdef
    )
    and exists (
      select 1
      from pg_catalog.pg_proc function_record
      join pg_catalog.pg_namespace function_schema
        on function_schema.oid = function_record.pronamespace
      where function_schema.nspname = 'private'
        and function_record.proname = 'public_listing_search_card_page_v3'
        and function_record.prosecdef
    )
    and exists (
      select 1
      from pg_catalog.pg_proc function_record
      join pg_catalog.pg_namespace function_schema
        on function_schema.oid = function_record.pronamespace
      where function_schema.nspname = 'public'
        and function_record.proname = 'public_automotive_dealers_page'
        and not function_record.prosecdef
    )
    and pg_catalog.to_regprocedure('public.get_public_seller_profile(uuid)') is not null
    and pg_catalog.to_regprocedure('public.get_public_seller_profile(text)') is null
    and pg_catalog.to_regprocedure('public.get_web_push_notification_preferences()') is not null
    and pg_catalog.to_regprocedure(
      'public.update_web_push_notification_preferences(boolean,boolean,boolean,boolean,boolean)'
    ) is not null;
$function$;

revoke all on function public.automotive_release_boundary_ready()
  from public, anon, authenticated, service_role;
grant execute on function public.automotive_release_boundary_ready()
  to anon, authenticated, service_role;

do $verify$
declare
  remaining integer;
begin
  select count(*)::integer into remaining
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public','private')
    and p.proname in (
      'bind_response_peek',
      'create_peek_request',
      'decline_peek_request',
      'disable_web_push_subscription',
      'merge_peek_request',
      'my_peek_request_ids',
      'owner_listing_contacts',
      'owner_service_contacts',
      'prepare_own_account_deletion',
      'queue_response_peek_binding',
      'register_web_push_subscription',
      'response_peek_request_candidates',
      'reveal_listing_contact',
      'reveal_service_contact',
      'seller_peek_request_queue',
      'seller_unbound_response_peeks',
      'support_peek_request',
      'withdraw_peek_request_support'
    )
    and pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE');

  if remaining <> 0 then
    raise exception 'anonymous EXECUTE remains on % authenticated-only RPC implementations/wrappers', remaining;
  end if;

  if not public.automotive_release_boundary_ready() then
    raise exception 'automotive release attestation failed after authenticated RPC anon closure';
  end if;
end;
$verify$;

commit;
