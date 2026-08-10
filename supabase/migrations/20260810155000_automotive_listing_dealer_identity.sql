begin;

-- Listing cards and detail pages need to distinguish an ordinary vehicle owner
-- from a currently approved dealership without trusting seller-supplied text.
-- This bounded projection returns only public identity fields and repeats the
-- same eligibility boundary used by the Dealers directory.
create or replace function private.public_automotive_dealer_identities(
  p_user_ids uuid[]
)
returns table (
  seller_user_id uuid,
  dealer_profile_id uuid,
  company_name text,
  city text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_user_ids is null
    or cardinality(p_user_ids) > 50
    or exists (select 1 from unnest(p_user_ids) value where value is null)
  then
    raise exception 'invalid automotive dealer identity request' using errcode = '22023';
  end if;

  return query
  select
    profile.user_id,
    profile.id,
    profile.company_name,
    profile.city
  from public.business_profiles profile
  join public.users account on account.id = profile.user_id
  where profile.user_id = any(p_user_ids)
    and account.status = 'active'::public.user_status
    and profile.business_type = 'car_dealership'::public.business_type
    and profile.profile_type = 'dealer'
    and profile.verified = true
    and exists (
      select 1
      from public.business_category_approvals approval
      where approval.user_id = profile.user_id
        and approval.category = 'car'
        and approval.status = 'approved'
    )
  order by profile.user_id;
end;
$$;

revoke all on function private.public_automotive_dealer_identities(uuid[])
  from public, anon, authenticated, service_role;
grant execute on function private.public_automotive_dealer_identities(uuid[])
  to anon, authenticated, service_role;

create or replace function public.public_automotive_dealer_identities(
  p_user_ids uuid[]
)
returns table (
  seller_user_id uuid,
  dealer_profile_id uuid,
  company_name text,
  city text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.public_automotive_dealer_identities(p_user_ids);
$$;

revoke all on function public.public_automotive_dealer_identities(uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.public_automotive_dealer_identities(uuid[])
  to anon, authenticated, service_role;

comment on function public.public_automotive_dealer_identities(uuid[]) is
  'Bounded public dealer identity lookup for vehicle sellers. Identity is returned only while the seller is an active verified car-dealership profile with current approved Cars business capability.';

commit;
