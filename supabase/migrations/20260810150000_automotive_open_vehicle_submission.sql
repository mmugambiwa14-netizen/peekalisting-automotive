begin;

-- Cars are the launch vertical. Active private sellers may submit a vehicle,
-- but vehicle publication is deliberately separate from submission. Dealer
-- approval remains a separate business capability and dormant listing families
-- retain the curated business-category gate.
create or replace function private.can_publish_in_category(p_category text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select case
    when lower(trim(coalesce(p_category, ''))) = 'car' then exists (
      select 1
      from public.users account
      where account.id = auth.uid()
        and account.status = 'active'::public.user_status
    )
    else exists (
      select 1
      from public.business_category_approvals approval
      where approval.user_id = auth.uid()
        and approval.category = lower(trim(coalesce(p_category, '')))
        and approval.status = 'approved'
    )
  end;
$$;

revoke all on function private.can_publish_in_category(text) from public, anon, authenticated, service_role;
grant execute on function private.can_publish_in_category(text) to authenticated, service_role;

-- The inherited marketplace auto-published every validated pending_review row.
-- Keep that legacy behavior for dormant, business-gated families, but cars now
-- remain pending until an administrator uses the existing moderation action.
create or replace function private.auto_publish_validated_mvp_listing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending_review' and new.kind::text <> 'car' then
    new.status := 'available';
    new.moderation_reason := null;
    new.expires_at := null;
    new.expiry_notice_sent_at := null;
  end if;
  return new;
end;
$$;

revoke all on function private.auto_publish_validated_mvp_listing() from public, anon, authenticated, service_role;

-- Keep the insert trigger as the authoritative publisher boundary. The mature
-- listing transaction predates automotive moderation and can still present a
-- validated row as `available`. Vehicle submissions must enter review before
-- publication, so every non-admin Cars insert is normalized to pending_review
-- here. Authenticated browser roles still have no direct INSERT grant on the
-- listings table; this trigger also fails safe if that grant boundary ever drifts.
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

  if v_category = 'car' then
    if not exists (
      select 1
      from public.users account
      where account.id = v_actor
        and account.status = 'active'::public.user_status
    ) then
      raise exception 'Active seller account required' using errcode = '42501';
    end if;

    new.status := 'pending_review'::public.listing_status;
    new.moderation_reason := null;
    new.expires_at := null;
    new.expiry_notice_sent_at := null;
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
      using errcode = '42501', detail = v_category;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_curated_listing_publisher() from public, anon, authenticated, service_role;

-- The authenticated public owner_transition_listing RPC is an invoker wrapper
-- around this private implementation after the repository's RPC hardening.
-- Re-submitting an automotive draft/rejection therefore returns it to review;
-- the owner can never use the lifecycle RPC to self-approve a car.
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
    next_status := case
      when listing_row.kind::text = 'car' then 'pending_review'::public.listing_status
      else 'available'::public.listing_status
    end;
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
  'Automotive launch boundary: active users may submit Cars, and every non-admin Cars insert is normalized to pending review before publication; dormant listing families retain business-category approval.';
comment on function private.auto_publish_validated_mvp_listing() is
  'Automotive specialization of the legacy auto-publication trigger: cars remain pending review while dormant curated families preserve prior behavior.';
comment on function private.owner_transition_listing(uuid, text) is
  'Owner listing lifecycle with automotive resubmission returning cars to pending review instead of self-publication.';

commit;
