begin;

create or replace function private.public_automotive_dealers_page(
  p_query text default '',
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 24
)
returns table (
  id uuid,
  user_id uuid,
  company_name text,
  business_type text,
  profile_type text,
  city text,
  address text,
  description text,
  avatar_url text,
  avatar_storage_path text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_query text := trim(coalesce(p_query, ''));
  escaped_query text;
begin
  if char_length(normalized_query) > 80
    or p_limit not between 1 and 48
    or ((p_cursor_created_at is null) <> (p_cursor_id is null))
  then
    raise exception 'invalid automotive dealer directory request' using errcode = '22023';
  end if;

  escaped_query := replace(replace(replace(normalized_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');

  return query
  select
    profile.id,
    profile.user_id,
    profile.company_name,
    profile.business_type::text,
    profile.profile_type,
    profile.city,
    profile.address,
    profile.description,
    profile.avatar_url,
    profile.avatar_storage_path,
    profile.created_at,
    profile.updated_at
  from public.business_profiles profile
  join public.users account on account.id = profile.user_id
  where account.status = 'active'::public.user_status
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
    and (
      normalized_query = ''
      or profile.company_name ilike '%' || escaped_query || '%' escape E'\\'
      or coalesce(profile.city, '') ilike '%' || escaped_query || '%' escape E'\\'
      or coalesce(profile.description, '') ilike '%' || escaped_query || '%' escape E'\\'
    )
    and (
      p_cursor_id is null
      or (profile.created_at, profile.id) < (p_cursor_created_at, p_cursor_id)
    )
  order by profile.created_at desc, profile.id desc
  limit p_limit + 1;
end;
$$;

revoke all on function private.public_automotive_dealers_page(text,timestamptz,uuid,integer)
  from public, anon, authenticated, service_role;
grant execute on function private.public_automotive_dealers_page(text,timestamptz,uuid,integer)
  to anon, authenticated, service_role;

create or replace function public.public_automotive_dealers_page(
  p_query text default '',
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 24
)
returns table (
  id uuid,
  user_id uuid,
  company_name text,
  business_type text,
  profile_type text,
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
security invoker
set search_path = ''
as $$
  select *
  from private.public_automotive_dealers_page(
    p_query,
    p_cursor_created_at,
    p_cursor_id,
    p_limit
  );
$$;

revoke all on function public.public_automotive_dealers_page(text,timestamptz,uuid,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.public_automotive_dealers_page(text,timestamptz,uuid,integer)
  to anon, authenticated, service_role;

comment on function public.public_automotive_dealers_page(text,timestamptz,uuid,integer) is
  'Minimal public automotive dealer directory. A dealer appears only while the account is active, the profile is a verified car dealership and Cars business approval remains current.';

commit;
