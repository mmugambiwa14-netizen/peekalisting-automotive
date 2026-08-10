begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('41000000-0000-4000-8000-000000000001', 'automotive-dealer@example.test', '{"full_name":"Approved Dealer"}', now(), now()),
  ('41000000-0000-4000-8000-000000000002', 'automotive-private@example.test', '{"full_name":"Private Seller"}', now(), now()),
  ('41000000-0000-4000-8000-000000000003', 'automotive-admin@example.test', '{"full_name":"Automotive Admin"}', now(), now());

update public.users set role = 'admin' where id = '41000000-0000-4000-8000-000000000003';

insert into public.business_applications (
  id, user_id, business_name, contact_name, business_email, business_phone,
  country_code, city, description, expected_inventory_band, status
) values (
  '41000000-0000-4000-8000-000000000101',
  '41000000-0000-4000-8000-000000000001',
  'Approved Cars Test', 'Approved Dealer', 'automotive-dealer@example.test', '+263700000001',
  'ZW', 'Harare', 'A complete dealer used for tiered automotive marketplace publication certification.', '1-10', 'approved'
);

insert into public.business_category_approvals (
  id, business_application_id, user_id, category, status
) values
  ('41000000-0000-4000-8000-000000000201', '41000000-0000-4000-8000-000000000101', '41000000-0000-4000-8000-000000000001', 'car', 'approved'),
  ('41000000-0000-4000-8000-000000000202', '41000000-0000-4000-8000-000000000101', '41000000-0000-4000-8000-000000000001', 'property', 'pending'),
  ('41000000-0000-4000-8000-000000000203', '41000000-0000-4000-8000-000000000101', '41000000-0000-4000-8000-000000000001', 'service', 'approved');

select extensions.ok(
  not has_function_privilege('anon', 'public.submit_business_application(text,text,text,text,text,text,text,text,text,text,text[])', 'EXECUTE'),
  'anonymous users cannot invoke business application submission'
);
select extensions.ok(
  has_function_privilege('authenticated', 'public.submit_business_application(text,text,text,text,text,text,text,text,text,text,text[])', 'EXECUTE'),
  'authenticated users can invoke business application submission'
);

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select extensions.ok(public.can_publish_in_category('car'), 'approved dealer can submit vehicles');
select extensions.ok(not public.can_publish_in_category('property'), 'dormant pending Property category remains gated');
select extensions.ok(public.can_publish_in_category('service'), 'approved Services business retains its category capability');
reset role;

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select extensions.ok(public.can_publish_in_category('car'), 'active private seller can submit a vehicle without becoming a business');
select extensions.ok(not public.can_publish_in_category('property'), 'private seller cannot use the open vehicle rule for Property');
select extensions.ok(not public.can_publish_in_category('service'), 'private seller cannot use the open vehicle rule for Services');
reset role;

-- The authoritative table trigger permits a legitimate private vehicle insert.
-- Public visibility is still controlled by the separate listing moderation
-- lifecycle; the normal submission RPC creates new adverts in pending_review.
select extensions.lives_ok(
  $$insert into public.listings (
      id, kind, seller_id, seller_name, title, description, price, currency,
      native_price, native_currency, photos, category, listing_type, status
    ) values (
      '41000000-0000-4000-8000-000000000401', 'car',
      '41000000-0000-4000-8000-000000000002', 'Private Seller',
      'Private seller vehicle',
      'A complete certification listing proving that an active private owner can cross the vehicle submission boundary.',
      15000, 'USD', 15000, 'USD', '[]'::jsonb, 'cars_sale', 'sale', 'draft'
    )$$,
  'active private seller vehicle insert succeeds'
);

select extensions.throws_ok(
  $$insert into public.listings (
      id, kind, seller_id, seller_name, title, description, price, currency,
      native_price, native_currency, photos, category, listing_type, status
    ) values (
      '41000000-0000-4000-8000-000000000402', 'property',
      '41000000-0000-4000-8000-000000000002', 'Private Seller',
      'Blocked property',
      'A complete certification listing that must fail because the automotive launch rule does not open Property publishing.',
      90000, 'USD', 90000, 'USD', '[]'::jsonb, 'house_sale', 'sale', 'draft'
    )$$,
  '42501',
  'Business category is not approved for publishing',
  'open automotive submission does not leak into dormant marketplace categories'
);

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
select extensions.throws_ok(
  $$insert into public.listings (
      id, kind, seller_id, seller_name, title, description, price, currency,
      native_price, native_currency, photos, category, listing_type, status
    ) values (
      '41000000-0000-4000-8000-000000000403', 'car',
      '41000000-0000-4000-8000-000000000002', 'Spoofed Seller',
      'Spoofed vehicle',
      'A complete certification listing that must fail because the authenticated actor is impersonating another seller.',
      14000, 'USD', 14000, 'USD', '[]'::jsonb, 'cars_sale', 'sale', 'draft'
    )$$,
  '42501',
  'Listing publisher identity mismatch',
  'open vehicle submission still rejects seller impersonation'
);

-- Automotive service businesses remain curated.
select extensions.lives_ok(
  $$insert into public.services (
      id, provider_id, provider_name, title, description, category,
      subcategories, currency, photos, status
    ) values (
      '41000000-0000-4000-8000-000000000501',
      '41000000-0000-4000-8000-000000000001', 'Approved Dealer',
      'Approved mechanic service',
      'A complete certification service proving that Services publishing still requires explicit business approval.',
      'mechanic', '[]'::jsonb, 'USD', '[]'::jsonb, 'active'
    )$$,
  'approved Services publisher insert succeeds'
);

select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000002', true);
select extensions.throws_ok(
  $$insert into public.services (
      id, provider_id, provider_name, title, description, category,
      subcategories, currency, photos, status
    ) values (
      '41000000-0000-4000-8000-000000000502',
      '41000000-0000-4000-8000-000000000002', 'Private Seller',
      'Blocked mechanic service',
      'A complete certification service that must fail because this user has no Services business approval.',
      'mechanic', '[]'::jsonb, 'USD', '[]'::jsonb, 'active'
    )$$,
  '42501',
  'Business category is not approved for publishing',
  'unapproved Services publisher insert is rejected'
);

-- Suspending dealership Cars approval removes dealership capability but does
-- not stop the same active person from using the ordinary private-seller
-- vehicle submission channel.
select set_config('request.jwt.claim.sub', '41000000-0000-4000-8000-000000000001', true);
update public.business_category_approvals
set status = 'suspended', reviewer_message = 'Certification suspension', updated_at = clock_timestamp()
where id = '41000000-0000-4000-8000-000000000201';

set local role authenticated;
select extensions.ok(public.can_publish_in_category('car'), 'dealer suspension does not disable the underlying private vehicle submission channel');
select extensions.throws_ok(
  $$select public.request_additional_business_categories(array['car'])$$,
  '42501',
  'Suspended categories cannot be re-requested',
  'a suspended dealer category cannot be self-restored'
);
select extensions.ok(
  exists (
    select 1 from public.get_my_publishing_access() access
    cross join lateral unnest(access.suspended_categories) as suspended_category
    where suspended_category = 'car'
  ),
  'business publishing access still reports the dealer suspension'
);
reset role;

select extensions.lives_ok(
  $$insert into public.listings (
      id, kind, seller_id, seller_name, title, description, price, currency,
      native_price, native_currency, photos, category, listing_type, status
    ) values (
      '41000000-0000-4000-8000-000000000404', 'car',
      '41000000-0000-4000-8000-000000000001', 'Approved Dealer',
      'Vehicle after dealer suspension',
      'A complete certification listing proving private automotive submission remains independent from dealer-category status.',
      13000, 'USD', 13000, 'USD', '[]'::jsonb, 'cars_sale', 'sale', 'draft'
    )$$,
  'active owner may still submit a vehicle after dealership capability is suspended'
);

select extensions.is(
  (select status from public.business_category_approvals where id = '41000000-0000-4000-8000-000000000201'),
  'suspended',
  'dealer suspension remains intact'
);
select extensions.is(
  (select reviewer_message from public.business_category_approvals where id = '41000000-0000-4000-8000-000000000201'),
  'Certification suspension',
  'dealer suspension reviewer message is preserved'
);

select extensions.ok(
  exists (
    select 1 from information_schema.triggers
    where event_object_schema = 'public' and event_object_table = 'listings'
      and trigger_name = 'listings_enforce_curated_publisher'
  ),
  'authoritative listing publisher trigger remains installed'
);
select extensions.ok(
  exists (
    select 1 from information_schema.triggers
    where event_object_schema = 'public' and event_object_table = 'services'
      and trigger_name = 'services_enforce_curated_publisher'
  ),
  'authoritative service publisher trigger remains installed'
);

select * from extensions.finish();
rollback;
