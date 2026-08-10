begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
values
  ('42000000-0000-4000-8000-000000000001', 'dealer-approved-profile@example.test', '{"full_name":"Approved Dealer Profile"}', now(), now()),
  ('42000000-0000-4000-8000-000000000002', 'dealer-pending-profile@example.test', '{"full_name":"Pending Dealer Profile"}', now(), now());

insert into public.business_profiles (
  id, user_id, company_name, business_type, phone, email, city, description
) values
  (
    '42000000-0000-4000-8000-000000000101',
    '42000000-0000-4000-8000-000000000001',
    'Approved Dealer Profile Test', 'car_dealership', '+263700000101',
    'dealer-approved-profile@example.test', 'Harare',
    'Approved dealership profile used to certify the public automotive profile visibility boundary.'
  ),
  (
    '42000000-0000-4000-8000-000000000102',
    '42000000-0000-4000-8000-000000000002',
    'Pending Dealer Profile Test', 'car_dealership', '+263700000102',
    'dealer-pending-profile@example.test', 'Harare',
    'Pending dealership profile used to certify that a guessed dealer URL cannot bypass approval.'
  );

insert into public.business_applications (
  id, user_id, business_name, contact_name, business_email, business_phone,
  country_code, city, description, expected_inventory_band, status
) values
  (
    '42000000-0000-4000-8000-000000000201',
    '42000000-0000-4000-8000-000000000001',
    'Approved Dealer Profile Test', 'Approved Dealer Profile',
    'dealer-approved-profile@example.test', '+263700000101', 'ZW', 'Harare',
    'Approved dealership application used to certify direct public dealer profile access.',
    '1-10', 'approved'
  ),
  (
    '42000000-0000-4000-8000-000000000202',
    '42000000-0000-4000-8000-000000000002',
    'Pending Dealer Profile Test', 'Pending Dealer Profile',
    'dealer-pending-profile@example.test', '+263700000102', 'ZW', 'Harare',
    'Pending dealership application used to certify direct public dealer profile access.',
    '1-10', 'reviewing'
  );

insert into public.business_category_approvals (
  id, business_application_id, user_id, category, status
) values
  (
    '42000000-0000-4000-8000-000000000301',
    '42000000-0000-4000-8000-000000000201',
    '42000000-0000-4000-8000-000000000001',
    'car', 'approved'
  ),
  (
    '42000000-0000-4000-8000-000000000302',
    '42000000-0000-4000-8000-000000000202',
    '42000000-0000-4000-8000-000000000002',
    'car', 'pending'
  );

select extensions.is(
  (select verified from public.business_profiles where id = '42000000-0000-4000-8000-000000000101'),
  true,
  'approved Cars capability synchronizes the dealer profile as verified'
);
select extensions.is(
  (select verified from public.business_profiles where id = '42000000-0000-4000-8000-000000000102'),
  false,
  'pending Cars capability leaves the dealer profile unverified'
);

set local role anon;
select extensions.is(
  (select count(*)::integer from public.business_profiles_public where id = '42000000-0000-4000-8000-000000000101'),
  1,
  'approved dealer profile is public through the direct profile projection'
);
select extensions.is(
  (select count(*)::integer from public.business_profiles_public where id = '42000000-0000-4000-8000-000000000102'),
  0,
  'pending dealer profile is hidden even when its profile id is known'
);
reset role;

update public.business_category_approvals
set status = 'suspended', reviewer_message = 'Dealer profile gate certification suspension'
where id = '42000000-0000-4000-8000-000000000301';

select extensions.is(
  (select verified from public.business_profiles where id = '42000000-0000-4000-8000-000000000101'),
  false,
  'suspending the only approved capability removes verified profile state'
);
set local role anon;
select extensions.is(
  (select count(*)::integer from public.business_profiles_public where id = '42000000-0000-4000-8000-000000000101'),
  0,
  'suspended dealer profile immediately disappears from the public direct profile projection'
);
reset role;

select * from extensions.finish();
rollback;
