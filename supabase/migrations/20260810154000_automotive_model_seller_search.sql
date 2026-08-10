begin;

-- Model is free text and buyers commonly search partial names such as "Hilux"
-- or "CX-5". pg_trgm is isolated in the non-API extensions schema by migration
-- 0082, so the operator class is explicitly schema-qualified here.
create index if not exists idx_car_details_automotive_model_trgm
  on public.car_details using gin (model extensions.gin_trgm_ops)
  where model is not null;

create or replace function private.public_listing_search_card_page_v3(
  p_kind text,
  p_country_code text default 'ZW',
  p_currency text default '',
  p_query text default '',
  p_category text default '',
  p_location_id text default '',
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_min_bedrooms integer default null,
  p_brand text default '',
  p_model text default '',
  p_seller_type text default '',
  p_condition text default '',
  p_fuel_type text default '',
  p_transmission text default '',
  p_body_type text default '',
  p_drivetrain text default '',
  p_import_status text default '',
  p_min_year integer default null,
  p_max_year integer default null,
  p_max_mileage integer default null,
  p_peek_only boolean default false,
  p_sort text default 'newest',
  p_cursor_value text default null,
  p_cursor_id uuid default null,
  p_limit integer default 24
)
returns table (
  id uuid,
  kind text,
  seller_id uuid,
  seller_name text,
  seller_type text,
  has_contact_phone boolean,
  has_contact_whatsapp boolean,
  has_contact_email boolean,
  title text,
  price numeric,
  currency text,
  variants jsonb,
  photos jsonb,
  latitude numeric,
  longitude numeric,
  public_location_label text,
  category text,
  listing_type text,
  status text,
  views integer,
  created_at timestamptz,
  car_details jsonb,
  property_details jsonb,
  machinery_details jsonb,
  has_current_peek boolean,
  cursor_value text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_query text := trim(coalesce(p_query, ''));
  normalized_model text := trim(coalesce(p_model, ''));
  normalized_seller_type text := lower(trim(coalesce(p_seller_type, '')));
  normalized_country text := upper(trim(coalesce(p_country_code, '')));
  normalized_currency text := upper(trim(coalesce(p_currency, '')));
  escaped_query text;
  escaped_model text;
  cursor_time timestamptz;
  cursor_number numeric;
  cursor_views integer;
begin
  if p_kind not in ('property', 'car', 'machinery')
    or p_sort not in ('newest', 'price_asc', 'price_desc', 'most_viewed')
    or normalized_seller_type not in ('', 'dealer', 'private')
    or p_limit not between 1 and 50
    or normalized_country !~ '^[A-Z]{2}$'
    or char_length(normalized_query) > 100
    or char_length(normalized_model) > 80
    or char_length(coalesce(p_category, '')) > 80
    or char_length(coalesce(p_location_id, '')) > 64
    or char_length(coalesce(p_brand, '')) > 80
    or char_length(coalesce(p_condition, '')) > 40
    or char_length(coalesce(p_fuel_type, '')) > 40
    or char_length(coalesce(p_transmission, '')) > 40
    or char_length(coalesce(p_body_type, '')) > 40
    or char_length(coalesce(p_drivetrain, '')) > 40
    or char_length(coalesce(p_import_status, '')) > 40
    or (p_min_price is not null and p_min_price < 0)
    or (p_max_price is not null and p_max_price < 0)
    or (p_min_price is not null and p_max_price is not null and p_max_price < p_min_price)
    or ((p_min_price is not null or p_max_price is not null) and normalized_currency = '')
    or (p_sort in ('price_asc', 'price_desc') and normalized_currency = '')
    or (p_min_year is not null and p_min_year not between 1886 and 2100)
    or (p_max_year is not null and p_max_year not between 1886 and 2100)
    or (p_min_year is not null and p_max_year is not null and p_max_year < p_min_year)
    or (p_max_mileage is not null and p_max_mileage not between 0 and 3000000)
    or ((p_cursor_value is null) <> (p_cursor_id is null))
  then
    raise exception 'invalid automotive listing search page' using errcode = '22023';
  end if;

  if p_kind <> 'car' and (normalized_model <> '' or normalized_seller_type <> '') then
    raise exception 'automotive-only search facet used outside Cars' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.country_configs country
    where country.country_code = normalized_country
      and country.operational_state in ('active', 'browse_only')
  ) then
    raise exception 'invalid automotive listing search market' using errcode = '22023';
  end if;

  if normalized_currency <> '' and not exists (
    select 1
    from public.country_configs country
    where country.country_code = normalized_country
      and normalized_currency = any(country.supported_listing_currencies)
  ) then
    raise exception 'invalid automotive listing search currency' using errcode = '22023';
  end if;

  escaped_query := replace(replace(replace(normalized_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');
  escaped_model := replace(replace(replace(normalized_model, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');

  if p_cursor_value is not null then
    begin
      if p_sort = 'newest' then cursor_time := p_cursor_value::timestamptz;
      elsif p_sort in ('price_asc', 'price_desc') then cursor_number := p_cursor_value::numeric;
      else cursor_views := p_cursor_value::integer;
      end if;
    exception when others then
      raise exception 'invalid automotive listing search cursor' using errcode = '22023';
    end;
  end if;

  return query
  with candidates as (
    select
      listing.*,
      car.listing_id as car_detail_listing_id,
      car.brand as car_brand,
      car.model as car_model,
      car.year as car_year,
      car.mileage as car_mileage,
      car.fuel_type as car_fuel_type,
      car.transmission as car_transmission,
      car.condition as car_condition,
      property.listing_id as property_detail_listing_id,
      property.property_type,
      property.bedrooms,
      property.bathrooms,
      property.size_sqm,
      machinery.listing_id as machinery_detail_listing_id,
      machinery.machinery_type,
      machinery.brand as machinery_brand,
      machinery.model as machinery_model,
      machinery.condition as machinery_condition,
      machinery.year as machinery_year,
      machinery.usage_hours,
      (
        listing.kind::text = 'car'
        and exists (
          select 1
          from public.business_profiles profile
          join public.users account on account.id = profile.user_id
          where profile.user_id = listing.seller_id
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
        )
      ) as is_dealer,
      exists (
        select 1
        from public.listing_tour_slots slot
        join public.listing_tours tour on tour.id = slot.current_tour_id
        where slot.listing_id = listing.id
          and tour.status = 'ready'
          and tour.moderation_status = 'approved'
          and tour.published_at is not null
          and tour.deleted_at is null
      ) as has_current_peek
    from public.listings listing
    left join public.car_details car on car.listing_id = listing.id
    left join public.property_details property on property.listing_id = listing.id
    left join public.machinery_details machinery on machinery.listing_id = listing.id
    where listing.kind::text = p_kind
      and coalesce(listing.country_code, 'ZW') = normalized_country
      and listing.status in ('available', 'under_offer')
      and listing.content_suspended_at is null
  )
  select
    listing.id,
    listing.kind::text,
    listing.seller_id,
    listing.seller_name,
    case
      when listing.kind::text <> 'car' then null
      when listing.is_dealer then 'dealer'
      else 'private'
    end,
    listing.has_contact_phone,
    listing.has_contact_whatsapp,
    listing.has_contact_email,
    listing.title,
    coalesce(listing.native_price, listing.price),
    coalesce(nullif(listing.native_currency, ''), nullif(listing.currency, ''), 'USD'),
    listing.variants,
    case
      when jsonb_typeof(listing.photos) = 'array' and jsonb_array_length(listing.photos) > 0
        then jsonb_build_array(listing.photos -> 0)
      else '[]'::jsonb
    end,
    listing.public_latitude,
    listing.public_longitude,
    listing.public_location_label,
    listing.category,
    listing.listing_type,
    listing.status::text,
    listing.views,
    listing.created_at,
    case when listing.car_detail_listing_id is null then null else jsonb_build_object(
      'brand', listing.car_brand,
      'model', listing.car_model,
      'year', listing.car_year,
      'mileage', listing.car_mileage,
      'fuel_type', listing.car_fuel_type,
      'transmission', listing.car_transmission,
      'condition', listing.car_condition
    ) end,
    case when listing.property_detail_listing_id is null then null else jsonb_build_object(
      'property_type', listing.property_type,
      'bedrooms', listing.bedrooms,
      'bathrooms', listing.bathrooms,
      'size_sqm', listing.size_sqm
    ) end,
    case when listing.machinery_detail_listing_id is null then null else jsonb_build_object(
      'machinery_type', listing.machinery_type,
      'brand', listing.machinery_brand,
      'model', listing.machinery_model,
      'condition', listing.machinery_condition,
      'year', listing.machinery_year,
      'usage_hours', listing.usage_hours
    ) end,
    listing.has_current_peek,
    case p_sort
      when 'newest' then listing.created_at::text
      when 'price_asc' then coalesce(listing.native_price, listing.price)::text
      when 'price_desc' then coalesce(listing.native_price, listing.price)::text
      else listing.views::text
    end
  from candidates listing
  where (normalized_currency = '' or (
      coalesce(nullif(listing.native_currency, ''), nullif(listing.currency, ''), 'USD') = normalized_currency
      and (p_min_price is null or coalesce(listing.native_price, listing.price) >= p_min_price)
      and (p_max_price is null or coalesce(listing.native_price, listing.price) <= p_max_price)
    ))
    and (coalesce(p_category, '') = '' or listing.category = p_category)
    and (coalesce(p_location_id, '') = '' or listing.location_id::text = p_location_id)
    and (
      normalized_query = ''
      or listing.search_document @@ websearch_to_tsquery('simple'::regconfig, normalized_query)
      or listing.title ilike '%' || escaped_query || '%' escape E'\\'
    )
    and (not p_peek_only or listing.has_current_peek)
    and (
      (p_kind = 'property'
        and listing.property_detail_listing_id is not null
        and (p_min_bedrooms is null or listing.bedrooms >= p_min_bedrooms))
      or (p_kind = 'car'
        and listing.car_detail_listing_id is not null
        and (coalesce(p_brand, '') = '' or listing.car_brand = p_brand)
        and (normalized_model = '' or listing.car_model ilike '%' || escaped_model || '%' escape E'\\')
        and (
          normalized_seller_type = ''
          or (normalized_seller_type = 'dealer' and listing.is_dealer)
          or (normalized_seller_type = 'private' and not listing.is_dealer)
        )
        and (coalesce(p_condition, '') = '' or listing.car_condition = p_condition)
        and (coalesce(p_fuel_type, '') = '' or listing.car_fuel_type::text = p_fuel_type)
        and (coalesce(p_transmission, '') = '' or listing.car_transmission::text = p_transmission)
        and (coalesce(p_body_type, '') = '' or listing.attributes -> 'values' ->> 'body_type' = p_body_type)
        and (coalesce(p_drivetrain, '') = '' or listing.attributes -> 'values' ->> 'drivetrain' = p_drivetrain)
        and (coalesce(p_import_status, '') = '' or listing.attributes -> 'values' ->> 'import_status' = p_import_status)
        and (p_min_year is null or listing.car_year >= p_min_year)
        and (p_max_year is null or listing.car_year <= p_max_year)
        and (p_max_mileage is null or listing.car_mileage <= p_max_mileage))
      or (p_kind = 'machinery'
        and listing.machinery_detail_listing_id is not null
        and (coalesce(p_brand, '') = '' or listing.machinery_brand = p_brand)
        and (coalesce(p_condition, '') = '' or listing.machinery_condition::text = p_condition))
    )
    and (
      p_cursor_id is null
      or (p_sort = 'newest' and (listing.created_at, listing.id) < (cursor_time, p_cursor_id))
      or (p_sort = 'price_asc' and (coalesce(listing.native_price, listing.price), listing.id) > (cursor_number, p_cursor_id))
      or (p_sort = 'price_desc' and (coalesce(listing.native_price, listing.price), listing.id) < (cursor_number, p_cursor_id))
      or (p_sort = 'most_viewed' and (listing.views, listing.id) < (cursor_views, p_cursor_id))
    )
  order by
    case when p_sort = 'newest' then listing.created_at end desc,
    case when p_sort = 'price_asc' then coalesce(listing.native_price, listing.price) end asc,
    case when p_sort = 'price_desc' then coalesce(listing.native_price, listing.price) end desc,
    case when p_sort = 'most_viewed' then listing.views end desc,
    case when p_sort = 'price_asc' then listing.id end asc,
    case when p_sort <> 'price_asc' then listing.id end desc
  limit p_limit + 1;
end;
$$;

revoke all on function private.public_listing_search_card_page_v3(
  text,text,text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,text,text,text,integer,integer,integer,boolean,text,text,uuid,integer
) from public, anon, authenticated, service_role;
grant execute on function private.public_listing_search_card_page_v3(
  text,text,text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,text,text,text,integer,integer,integer,boolean,text,text,uuid,integer
) to anon, authenticated, service_role;

create or replace function public.public_listing_search_card_page_v3(
  p_kind text,
  p_country_code text default 'ZW',
  p_currency text default '',
  p_query text default '',
  p_category text default '',
  p_location_id text default '',
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_min_bedrooms integer default null,
  p_brand text default '',
  p_model text default '',
  p_seller_type text default '',
  p_condition text default '',
  p_fuel_type text default '',
  p_transmission text default '',
  p_body_type text default '',
  p_drivetrain text default '',
  p_import_status text default '',
  p_min_year integer default null,
  p_max_year integer default null,
  p_max_mileage integer default null,
  p_peek_only boolean default false,
  p_sort text default 'newest',
  p_cursor_value text default null,
  p_cursor_id uuid default null,
  p_limit integer default 24
)
returns table (
  id uuid,
  kind text,
  seller_id uuid,
  seller_name text,
  seller_type text,
  has_contact_phone boolean,
  has_contact_whatsapp boolean,
  has_contact_email boolean,
  title text,
  price numeric,
  currency text,
  variants jsonb,
  photos jsonb,
  latitude numeric,
  longitude numeric,
  public_location_label text,
  category text,
  listing_type text,
  status text,
  views integer,
  created_at timestamptz,
  car_details jsonb,
  property_details jsonb,
  machinery_details jsonb,
  has_current_peek boolean,
  cursor_value text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.public_listing_search_card_page_v3(
    p_kind,
    p_country_code,
    p_currency,
    p_query,
    p_category,
    p_location_id,
    p_min_price,
    p_max_price,
    p_min_bedrooms,
    p_brand,
    p_model,
    p_seller_type,
    p_condition,
    p_fuel_type,
    p_transmission,
    p_body_type,
    p_drivetrain,
    p_import_status,
    p_min_year,
    p_max_year,
    p_max_mileage,
    p_peek_only,
    p_sort,
    p_cursor_value,
    p_cursor_id,
    p_limit
  );
$$;

revoke all on function public.public_listing_search_card_page_v3(
  text,text,text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,text,text,text,integer,integer,integer,boolean,text,text,uuid,integer
) from public, anon, authenticated, service_role;
grant execute on function public.public_listing_search_card_page_v3(
  text,text,text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,text,text,text,integer,integer,integer,boolean,text,text,uuid,integer
) to anon, authenticated, service_role;

comment on function public.public_listing_search_card_page_v3(
  text,text,text,text,text,text,numeric,numeric,integer,text,text,text,text,text,text,text,text,text,integer,integer,integer,boolean,text,text,uuid,integer
) is 'Automotive marketplace search V3: adds indexed model matching and authoritative approved-dealer versus private-seller filtering while preserving bounded public projection and keyset pagination.';

commit;
