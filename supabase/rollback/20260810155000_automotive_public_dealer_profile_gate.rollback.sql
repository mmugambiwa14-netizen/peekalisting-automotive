begin;

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
  select profile.id, profile.user_id, profile.company_name, profile.business_type,
         profile.profile_type, profile.verified,
         profile.phone, profile.email, profile.website, profile.social_links,
         profile.city, profile.address, profile.description, profile.avatar_url,
         profile.avatar_storage_path, profile.created_at, profile.updated_at
  from public.business_profiles profile
  join public.users owner_user on owner_user.id = profile.user_id
  where owner_user.status = 'active'::public.user_status
    and profile.business_type <> 'legal_firm'::public.business_type;
$$;

revoke all on function private.public_business_profiles() from public;
grant execute on function private.public_business_profiles() to anon, authenticated, service_role;

comment on function private.public_business_profiles() is
  'Public active business-profile projection restored without the automotive dealer approval filter.';

commit;
