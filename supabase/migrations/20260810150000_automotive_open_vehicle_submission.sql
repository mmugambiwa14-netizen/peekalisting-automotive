begin;

-- Cars are the launch vertical. Active private sellers may submit a vehicle,
-- but the existing listing-creation transaction still creates it in
-- pending_review. Dealer/business approval remains a separate capability and
-- all dormant listing families remain behind the curated publishing gate.
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

-- Keep the trigger as the authoritative insert boundary. This protects direct
-- SQL/RPC paths in addition to the application service.
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

comment on function public.enforce_curated_listing_publisher() is
  'Automotive launch publisher boundary: active users may submit cars into moderation; dormant listing families retain business-category approval.';

commit;
