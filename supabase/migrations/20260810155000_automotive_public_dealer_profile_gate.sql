begin;

-- Dealer discovery and direct dealer URLs must enforce the same Cars approval
-- boundary. Owner/admin profile reads continue to use the base table and are
-- unaffected; only the public projection is narrowed for dealership profiles.
create or replace function private.public_business_profiles()
returns table (
  id uuid,
  user_id uuid,
  company_name text,
  business_type public.business_type,
  profile_type text,
  verified boolean,
  phone text,
  email text,
  website text,
  social_links jsonb,
  city text,
  address text,
  description text,
  avatar_url text,
  avatar_storage_path text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profile.id,
    profile.user_id,
    profile.company_name,
    profile.business_type,
    profile.profile_type,
    profile.verified,
    profile.phone,
    profile.email,
    profile.website,
    profile.social_links,
    profile.city,
    profile.address,
    profile.description,
    profile.avatar_url,
    profile.avatar_storage_path,
    profile.created_at,
    profile.updated_at
  from public.business_profiles profile
  join public.users owner_user on owner_user.id = profile.user_id
  where owner_user.status = 'active'::public.user_status
    and profile.business_type <> 'legal_firm'::public.business_type
    and (
      profile.business_type <> 'car_dealership'::public.business_type
      or (
        profile.verified = true
        and exists (
          select 1
          from public.business_category_approvals approval
          where approval.user_id = profile.user_id
            and approval.category = 'car'
            and approval.status = 'approved'
        )
      )
    );
$$;

revoke all on function private.public_business_profiles() from public;
grant execute on function private.public_business_profiles() to anon, authenticated, service_role;

comment on function private.public_business_profiles() is
  'Public business-profile projection. Automotive dealer profiles are visible only while Cars business approval is currently approved.';

commit;
