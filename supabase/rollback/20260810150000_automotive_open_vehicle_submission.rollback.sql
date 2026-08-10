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

comment on function public.enforce_curated_listing_publisher() is
  'Authoritative category-approval gate for Property, Cars and Machinery listing publication.';

commit;
