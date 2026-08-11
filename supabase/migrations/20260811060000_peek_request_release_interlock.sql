-- PeekaListing Automotive can expose the Peek Request data model before the
-- full Response Peek media pipeline is accepted, but it must not create new
-- demand that sellers cannot fulfil. Reuse the existing `tours` backend feature
-- control so direct PostgREST callers and stale browser bundles fail closed in
-- exactly the same release state as the frontend.

create or replace function private.create_peek_request(
  p_listing_id uuid default null,
  p_service_id uuid default null,
  p_category public.peek_request_category default 'custom',
  p_body text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_body text := btrim(regexp_replace(coalesce(p_body, ''), '[\n\r\t]+', ' ', 'g'));
  v_recent_count integer;
begin
  if not exists (
    select 1
    from public.marketplace_feature_controls control
    where control.feature_key = 'tours'
      and control.enabled
  ) then
    raise exception 'Peek Requests are temporarily unavailable while Response Peek capture is disabled'
      using errcode = '55000';
  end if;

  if not public.is_active_user() then
    raise exception 'an active account is required' using errcode = '42501';
  end if;
  if ((p_listing_id is not null)::integer + (p_service_id is not null)::integer) <> 1 then
    raise exception 'exactly one Peek Request parent is required' using errcode = '22023';
  end if;
  if char_length(v_body) not between 8 and 280 then
    raise exception 'Peek Request must be between 8 and 280 characters' using errcode = '22023';
  end if;
  if not private.is_peek_parent_public(p_listing_id, p_service_id) then
    raise exception 'this listing is not accepting public Peek Requests' using errcode = '42501';
  end if;
  if (
    p_listing_id is not null
    and exists (
      select 1 from public.listings listing
      where listing.id = p_listing_id and listing.seller_id = auth.uid()
    )
  ) or (
    p_service_id is not null
    and exists (
      select 1 from public.services service
      where service.id = p_service_id and service.provider_id = auth.uid()
    )
  ) then
    raise exception 'owners cannot request Peeks from themselves' using errcode = '42501';
  end if;

  select count(*)
  into v_recent_count
  from public.peek_requests request
  where request.requester_id = auth.uid()
    and request.category = p_category
    and request.created_at >= now() - interval '30 minutes';

  if v_recent_count >= 3 then
    raise exception 'too many recent Peek Requests in this category' using errcode = '42900';
  end if;

  insert into public.peek_requests(
    listing_id,
    service_id,
    requester_id,
    category,
    body,
    status,
    moderation_status,
    supporter_count
  )
  values (
    p_listing_id,
    p_service_id,
    auth.uid(),
    p_category,
    v_body,
    'pending',
    'pending',
    0
  )
  returning id into v_id;

  return v_id;
end;
$function$;

create or replace function private.support_peek_request(p_request_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer;
begin
  if not exists (
    select 1
    from public.marketplace_feature_controls control
    where control.feature_key = 'tours'
      and control.enabled
  ) then
    raise exception 'Peek Requests are temporarily unavailable while Response Peek capture is disabled'
      using errcode = '55000';
  end if;

  if not public.is_active_user() then
    raise exception 'an active account is required' using errcode = '42501';
  end if;

  if not private.peek_request_support_allowed(p_request_id) then
    raise exception 'this Peek Request cannot be supported' using errcode = '42501';
  end if;

  insert into public.peek_request_supporters(request_id, user_id)
  values (p_request_id, auth.uid())
  on conflict (request_id, user_id) do nothing;

  select supporter_count
  into v_count
  from public.peek_requests
  where id = p_request_id;

  return coalesce(v_count, 0);
end;
$function$;

create or replace function private.accept_peek_request(p_request_id uuid)
returns public.peek_request_fulfilments
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request public.peek_requests;
  v_owner uuid;
  v_existing public.peek_request_fulfilments;
  v_row public.peek_request_fulfilments;
  v_max_attempts integer := public.tour_processing_max_attempts();
begin
  if not exists (
    select 1
    from public.marketplace_feature_controls control
    where control.feature_key = 'tours'
      and control.enabled
  ) then
    raise exception 'Response Peek capture is not enabled in this environment'
      using errcode = '55000';
  end if;

  if not public.is_active_user() then
    raise exception 'Active account required' using errcode = '42501';
  end if;

  select *
  into v_request
  from public.peek_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Peek Request not found' using errcode = 'P0002';
  end if;

  v_owner := private.peek_request_parent_owner(v_request);
  if v_owner is distinct from auth.uid() then
    raise exception 'Only the listing owner can accept this Peek Request' using errcode = '42501';
  end if;
  if v_request.status <> 'pending'
    or v_request.moderation_status <> 'approved'
    or v_request.merged_into_id is not null then
    raise exception 'This Peek Request cannot be accepted' using errcode = '22023';
  end if;

  select *
  into v_existing
  from public.peek_request_fulfilments
  where request_id = p_request_id
  for update;

  if found and v_existing.status in ('accepted', 'uploading', 'processing') then
    return v_existing;
  end if;
  if found and v_existing.status = 'completed' then
    raise exception 'This Peek Request is already completed' using errcode = '22023';
  end if;
  if found and v_existing.attempt_count >= v_max_attempts then
    raise exception 'Peek Request fulfilment retry limit reached' using errcode = '22023';
  end if;

  if found then
    delete from public.peek_response_binding_intents
    where request_id = p_request_id
      and owner_id = auth.uid();
  end if;

  insert into public.peek_request_fulfilments(
    request_id,
    owner_id,
    status,
    attempt_count,
    accepted_at,
    expires_at,
    updated_at
  )
  values (
    p_request_id,
    auth.uid(),
    'accepted',
    1,
    now(),
    now() + interval '48 hours',
    now()
  )
  on conflict (request_id) do update
  set owner_id = excluded.owner_id,
      tour_id = null,
      status = 'accepted',
      attempt_count = public.peek_request_fulfilments.attempt_count + 1,
      failure_reason = null,
      accepted_at = now(),
      started_at = null,
      completed_at = null,
      cancelled_at = null,
      expires_at = now() + interval '48 hours',
      updated_at = now()
  returning * into v_row;

  return v_row;
end;
$function$;

-- Preserve the authenticated-only public/private execution boundary established
-- by the automotive RPC closure.
revoke execute on function private.create_peek_request(uuid, uuid, public.peek_request_category, text)
  from public, anon;
revoke execute on function private.support_peek_request(uuid) from public, anon;
revoke execute on function private.accept_peek_request(uuid) from public, anon;

do $verify$
begin
  if coalesce((
    select enabled
    from public.marketplace_feature_controls
    where feature_key = 'tours'
  ), false) then
    raise exception 'automotive Peek request release interlock expected Tours to remain disabled';
  end if;

  if has_function_privilege('anon', 'private.create_peek_request(uuid,uuid,public.peek_request_category,text)', 'EXECUTE')
    or has_function_privilege('anon', 'private.support_peek_request(uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'private.accept_peek_request(uuid)', 'EXECUTE') then
    raise exception 'automotive Peek request release interlock left anonymous private execution';
  end if;
end;
$verify$;
