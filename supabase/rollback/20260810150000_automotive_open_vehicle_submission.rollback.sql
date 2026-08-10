begin;

create or replace function private.can_publish_in_category(p_category text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.business_category_approvals approval
    where approval.user_id = auth.uid()
      and approval.category = p_category
      and approval.status = 'approved'
  );
$$;

revoke all on function private.can_publish_in_category(text) from public, anon, authenticated, service_role;
grant execute on function private.can_publish_in_category(text) to authenticated, service_role;

create or replace function private.auto_publish_validated_mvp_listing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending_review' then
    new.status := 'available';
    new.moderation_reason := null;
    new.expires_at := null;
    new.expiry_notice_sent_at := null;
  end if;
  return new;
end;
$$;

revoke all on function private.auto_publish_validated_mvp_listing() from public, anon, authenticated, service_role;

create or replace function public.enforce_curated_listing_publisher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_category text := new.kind::text;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if new.seller_id <> v_actor and not public.is_admin() then
    raise exception 'Listing publisher identity mismatch' using errcode = '42501';
  end if;

  if public.is_admin() then
    return new;
  end if;

  if not exists (
    select 1
    from public.business_category_approvals approval
    where approval.user_id = v_actor
      and approval.category = v_category
      and approval.status = 'approved'
  ) then
    raise exception 'Business category is not approved for publishing'
      using errcode = '42501', detail = v_category,
            hint = 'Apply for category approval or use the managed listing service.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_curated_listing_publisher() from public, anon, authenticated, service_role;

create or replace function private.owner_transition_listing(
  p_listing_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing_row public.listings%rowtype;
  next_status public.listing_status;
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_action not in ('submit', 'pause', 'resume', 'unavailable') then
    raise exception 'invalid owner listing action' using errcode = '22023';
  end if;

  select * into listing_row
  from public.listings
  where id = p_listing_id and seller_id = auth.uid()
  for update;
  if not found then
    raise exception 'listing not found' using errcode = 'P0002';
  end if;

  if p_action = 'submit' and listing_row.status in ('draft', 'rejected', 'expired', 'unavailable') then
    if not exists (select 1 from public.listing_media where listing_id = p_listing_id) then
      raise exception 'at least one validated image is required' using errcode = '22023';
    end if;
    next_status := 'available';
  elsif p_action = 'pause' and listing_row.status in ('available', 'under_offer', 'rented') then
    next_status := 'paused';
  elsif p_action = 'resume' and listing_row.status = 'paused' then
    next_status := 'available';
  elsif p_action = 'unavailable' and listing_row.status in ('available', 'under_offer', 'rented', 'paused') then
    next_status := 'unavailable';
  else
    raise exception 'listing action is not allowed from the current status' using errcode = '22023';
  end if;

  update public.listings
  set status = next_status,
      submitted_at = case when p_action = 'submit' then now() else submitted_at end,
      moderation_reason = null,
      expires_at = case when next_status = 'available' then null else expires_at end,
      expiry_notice_sent_at = case when next_status = 'available' then null else expiry_notice_sent_at end
  where id = p_listing_id
  returning * into listing_row;

  return jsonb_build_object('id', listing_row.id, 'kind', listing_row.kind, 'status', listing_row.status);
end;
$$;

comment on function public.enforce_curated_listing_publisher() is
  'Authoritative category-approval gate for Property, Cars and Machinery listing publication.';
comment on function private.auto_publish_validated_mvp_listing() is
  'MVP publication boundary: automatically publishes listings after category, payload and media validation; no human listing review.';

commit;
