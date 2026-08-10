import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertSmokeTarget } from './lib/smoke-target.mjs';

const url = process.env.FINDIT_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const anonKey = process.env.FINDIT_SUPABASE_ANON_KEY;
const secretKey = process.env.FINDIT_SUPABASE_SECRET_KEY;
const appOrigin = process.env.FINDIT_SMOKE_APP_ORIGIN ?? 'http://localhost:5173';
const smokeTarget = assertSmokeTarget(url, 'The automotive search V3 smoke test');
if (!anonKey || !secretKey) throw new Error('A Supabase publishable key and secret key are required.');

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const root = createClient(url, secretKey, options);
const publicClient = createClient(url, anonKey, options);
const stamp = Date.now();
const marker = `autoscale${stamp}`;
const password = `Peeka-${crypto.randomBytes(24).toString('base64url')}!9aA`;
const pageSize = 24;
const fixtureCount = Number(process.env.FINDIT_AUTOMOTIVE_SEARCH_FIXTURE_COUNT ?? 104);
const half = fixtureCount / 2;
const privateEmail = `${marker}-private@example.test`;
const dealerEmail = `${marker}-dealer@example.test`;
const adminEmail = `${marker}-admin@example.test`;
const functionUrl = `${url}/functions/v1/listing-image-upload`;
const pngBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

let privateUserId;
let dealerUserId;
let adminUserId;
let businessProfileId;
let businessApplicationId;
let privateClient;
let dealerClient;
let adminClient;
const listingIds = [];
const storagePaths = [];

function success(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message ?? 'unknown error'}`);
  return result.data;
}

function authenticatedClient() {
  return createClient(url, anonKey, options);
}

async function signIn(email) {
  const client = authenticatedClient();
  const session = success(await client.auth.signInWithPassword({ email, password }), `sign in ${email}`).session;
  return { client, session };
}

async function boundedMap(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function uploadListingImage(accessToken, sequence) {
  const form = new FormData();
  form.append('file', new File([pngBytes], `${marker}-${sequence}.png`, { type: 'image/png' }));
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      Origin: appOrigin,
    },
    body: form,
  });
  let body;
  try { body = await response.json(); } catch { body = {}; }
  assert.equal(response.status, 201, `upload image ${sequence}: ${JSON.stringify(body)}`);
  assert.match(body.path ?? '', /^[0-9a-f-]{36}\/staging\/[0-9a-f-]{36}\.png$/);
  assert.ok(body.intentId, `upload image ${sequence} returns an intent`);
  storagePaths.push(body.path);
  return { intentId: body.intentId, path: body.path };
}

function fixture(sequence, sellerType) {
  const hilux = sequence % 2 === 0;
  return {
    sequence,
    sellerType,
    title: `${marker} Toyota ${hilux ? 'Hilux' : 'Corolla'} ${String(sequence).padStart(4, '0')}`,
    model: hilux ? `Hilux Workmate ${sequence}` : `Corolla Quest ${sequence}`,
    price: 10000 + sequence,
  };
}

async function submitFixture({ client, accessToken, item }) {
  const media = await uploadListingImage(accessToken, item.sequence);
  const created = success(await client.rpc('create_v2_listing_submission', {
    p_submission_key: crypto.randomUUID(),
    p_listing: {
      kind: 'car',
      title: item.title,
      description: 'Disposable automotive V3 search fixture created through the real validated listing-submission path.',
      category: 'cars_sale',
      listingType: 'sale',
      price: item.price,
      currency: 'USD',
      negotiable: true,
      locationId: '00000000-0000-4000-8000-000000000101',
      contactPhone: item.sellerType === 'dealer' ? '+263700000099' : '+263700000098',
    },
    p_detail: {
      brand: 'Toyota',
      model: item.model,
      year: 2010 + (item.sequence % 15),
      mileage: 40000 + item.sequence * 100,
      fuel_type: item.sequence % 2 === 0 ? 'diesel' : 'petrol',
      transmission: item.sequence % 3 === 0 ? 'automatic' : 'manual',
      condition: 'good',
    },
    p_attributes: {
      version: 1,
      values: {
        body_type: item.sequence % 2 === 0 ? 'bakkie' : 'sedan',
        drivetrain: item.sequence % 2 === 0 ? '4x4' : 'fwd',
        import_status: 'locally_registered',
      },
    },
    p_media: [media],
  }), `submit ${item.sellerType} Cars fixture ${item.sequence}`);
  assert.equal(created.status, 'pending_review', 'seller submission must remain pending before admin approval');
  listingIds.push(created.id);
  return { ...item, id: created.id };
}

async function approveFixture(item) {
  success(await adminClient.rpc('admin_moderate_marketplace_item', {
    p_item_id: item.id,
    p_kind: 'car',
    p_action: 'publish',
    p_reason: `Automotive V3 scale smoke approval ${item.sequence}`,
  }), `approve automotive fixture ${item.sequence}`);
}

async function searchPage({ model = '', sellerType = '', sort = 'newest', currency = '', cursor = null } = {}) {
  return success(await publicClient.rpc('public_listing_search_card_page_v3', {
    p_kind: 'car',
    p_country_code: 'ZW',
    p_currency: currency,
    p_query: marker,
    p_category: '',
    p_location_id: '',
    p_min_price: null,
    p_max_price: null,
    p_min_bedrooms: null,
    p_brand: 'Toyota',
    p_model: model,
    p_seller_type: sellerType,
    p_condition: '',
    p_fuel_type: '',
    p_transmission: '',
    p_body_type: '',
    p_drivetrain: '',
    p_import_status: '',
    p_min_year: null,
    p_max_year: null,
    p_max_mileage: null,
    p_peek_only: false,
    p_sort: sort,
    p_cursor_value: cursor?.value ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: pageSize,
  }), `automotive ${sellerType || 'all'} ${model || 'all-models'} ${sort} page`);
}

async function traverse(search = {}) {
  const seen = new Set();
  const rows = [];
  let cursor = null;
  for (let pageNumber = 1; pageNumber <= 20; pageNumber += 1) {
    const result = await searchPage({ ...search, cursor });
    assert.ok(result.length <= pageSize + 1, 'V3 returns at most limit+1 rows');
    const page = result.slice(0, pageSize);
    for (const row of page) {
      assert.equal(seen.has(row.id), false, `V3 page ${pageNumber} must not repeat ${row.id}`);
      assert.equal(Object.hasOwn(row, 'description'), false, 'V3 cards must not expose listing descriptions');
      assert.equal(Object.hasOwn(row, 'attributes'), false, 'V3 cards must not expose raw schema attributes');
      assert.ok(Array.isArray(row.photos) && row.photos.length <= 1, 'V3 cards carry at most one cover image');
      assert.ok(['dealer', 'private'].includes(row.seller_type), 'Cars carry an authoritative seller type');
      seen.add(row.id);
      rows.push(row);
    }
    if (result.length <= pageSize) return rows;
    const last = page.at(-1);
    cursor = { value: last.cursor_value, id: last.id };
  }
  throw new Error('Automotive V3 keyset traversal exceeded the bounded smoke page limit.');
}

async function removeStoragePaths(paths) {
  for (let index = 0; index < paths.length; index += 50) {
    try { await root.storage.from('listing-images').remove(paths.slice(index, index + 50)); } catch { /* best effort */ }
  }
}

try {
  if (!Number.isInteger(fixtureCount) || fixtureCount < 100 || fixtureCount > 120 || fixtureCount % 4 !== 0) {
    throw new Error('FINDIT_AUTOMOTIVE_SEARCH_FIXTURE_COUNT must be a multiple of 4 from 100 to 120.');
  }

  privateUserId = success(await root.auth.admin.createUser({
    email: privateEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Automotive Private Fixture' },
  }), 'create private automotive fixture user').user.id;

  dealerUserId = success(await root.auth.admin.createUser({
    email: dealerEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Automotive Dealer Fixture' },
  }), 'create dealer automotive fixture user').user.id;

  adminUserId = success(await root.auth.admin.createUser({
    email: adminEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Automotive Admin Fixture' },
  }), 'create automotive admin fixture user').user.id;
  success(await root.from('users').update({ role: 'admin', super_admin: true }).eq('id', adminUserId), 'grant automotive smoke admin');

  businessProfileId = success(await root.from('business_profiles').insert({
    user_id: dealerUserId,
    company_name: `${marker} Motors`,
    business_type: 'car_dealership',
    phone: '+263700000099',
    email: dealerEmail,
    city: 'Harare',
    description: 'Disposable verified dealership fixture for automotive search certification.',
  }).select('id').single(), 'create dealer business profile').id;

  businessApplicationId = success(await root.from('business_applications').insert({
    user_id: dealerUserId,
    business_name: `${marker} Motors`,
    contact_name: 'Automotive Dealer Fixture',
    business_email: dealerEmail,
    business_phone: '+263700000099',
    country_code: 'ZW',
    city: 'Harare',
    description: 'Disposable approved dealership application for automotive V3 search certification.',
    expected_inventory_band: '51-200',
    status: 'approved',
  }).select('id').single(), 'create dealer business application').id;

  success(await root.from('business_category_approvals').insert({
    business_application_id: businessApplicationId,
    user_id: dealerUserId,
    category: 'car',
    status: 'approved',
  }), 'approve Cars business capability');

  const verifiedProfile = success(await root.from('business_profiles').select('verified, profile_type, business_type').eq('id', businessProfileId).single(), 'read synchronized dealer profile');
  assert.equal(verifiedProfile.verified, true, 'approved Cars capability synchronizes verified business profile');
  assert.equal(verifiedProfile.profile_type, 'dealer');
  assert.equal(verifiedProfile.business_type, 'car_dealership');

  const [privateAuth, dealerAuth, adminAuth] = await Promise.all([
    signIn(privateEmail),
    signIn(dealerEmail),
    signIn(adminEmail),
  ]);
  privateClient = privateAuth.client;
  dealerClient = dealerAuth.client;
  adminClient = adminAuth.client;

  const privateFixtures = Array.from({ length: half }, (_, index) => fixture(index, 'private'));
  const dealerFixtures = Array.from({ length: half }, (_, index) => fixture(half + index, 'dealer'));
  const [submittedPrivate, submittedDealer] = await Promise.all([
    boundedMap(privateFixtures, 4, (item) => submitFixture({ client: privateClient, accessToken: privateAuth.session.access_token, item })),
    boundedMap(dealerFixtures, 4, (item) => submitFixture({ client: dealerClient, accessToken: dealerAuth.session.access_token, item })),
  ]);
  const submitted = [...submittedPrivate, ...submittedDealer];
  assert.equal(submitted.length, fixtureCount);
  assert.equal(listingIds.length, fixtureCount);

  await boundedMap(submitted, 6, approveFixture);
  const published = success(await root.from('listings').select('id,status').in('id', listingIds), 'read approved automotive fixtures');
  assert.equal(published.length, fixtureCount);
  assert.equal(published.every((row) => row.status === 'available'), true, 'admin approval publishes every smoke vehicle');

  const all = await traverse();
  assert.equal(all.length, fixtureCount, 'V3 keyset traversal reaches the complete automotive fixture set');
  assert.equal(new Set(all.map((row) => row.id)).size, fixtureCount, 'V3 traversal has no duplicates beyond 100 Cars');

  const dealers = await traverse({ sellerType: 'dealer' });
  assert.equal(dealers.length, half, 'dealer filter returns exactly dealer-owned Cars');
  assert.equal(dealers.every((row) => row.seller_id === dealerUserId && row.seller_type === 'dealer'), true);

  const privateRows = await traverse({ sellerType: 'private' });
  assert.equal(privateRows.length, half, 'private filter excludes approved dealership Cars');
  assert.equal(privateRows.every((row) => row.seller_id === privateUserId && row.seller_type === 'private'), true);

  const hiluxRows = await traverse({ model: 'Hilux' });
  assert.equal(hiluxRows.length, fixtureCount / 2, 'partial model search matches the expected Hilux fixtures');
  assert.equal(hiluxRows.every((row) => String(row.car_details?.model || '').includes('Hilux')), true);

  const dealerHilux = await traverse({ sellerType: 'dealer', model: 'Hilux' });
  assert.equal(dealerHilux.length, fixtureCount / 4, 'model and authoritative seller type compose correctly');

  const ascending = await traverse({ sort: 'price_asc', currency: 'USD' });
  assert.deepEqual(
    ascending.map((row) => Number(row.price)),
    Array.from({ length: fixtureCount }, (_, index) => 10000 + index),
    'V3 price keysets preserve seller-native USD ordering',
  );

  const invalidSeller = await publicClient.rpc('public_listing_search_card_page_v3', {
    p_kind: 'car',
    p_country_code: 'ZW',
    p_query: marker,
    p_seller_type: 'verified_private',
    p_limit: pageSize,
  });
  assert.match(invalidSeller.error?.message || '', /invalid automotive listing search page/i, 'database rejects invented seller classifications');

  console.log(`Automotive V3 ${smokeTarget.label} search smoke passed.`);
  console.log(`Verified ${fixtureCount} Cars created through validated image upload + V2 submission + admin approval, with >100-row keysets, partial model search, authoritative seller-type composition, thin projection and seller-native price ordering.`);
} finally {
  if (listingIds.length) {
    try { await root.from('app_alerts').delete().in('listing_id', listingIds); } catch { /* best effort */ }
    try { await root.from('audit_logs').delete().in('target_record_id', listingIds); } catch { /* best effort */ }
    try { await root.from('listings').delete().in('id', listingIds); } catch { /* best effort */ }
  }
  await removeStoragePaths(storagePaths);
  if (storagePaths.length) {
    try { await root.from('listing_upload_intents').delete().in('storage_path', storagePaths); } catch { /* best effort */ }
  }
  if (businessApplicationId) {
    try { await root.from('business_applications').delete().eq('id', businessApplicationId); } catch { /* best effort */ }
  }
  if (businessProfileId) {
    try { await root.from('business_profiles').delete().eq('id', businessProfileId); } catch { /* best effort */ }
  }
  try { await privateClient?.auth.signOut(); } catch { /* best effort */ }
  try { await dealerClient?.auth.signOut(); } catch { /* best effort */ }
  try { await adminClient?.auth.signOut(); } catch { /* best effort */ }
  if (privateUserId) {
    try { await root.auth.admin.deleteUser(privateUserId); } catch { /* best effort */ }
  }
  if (dealerUserId) {
    try { await root.auth.admin.deleteUser(dealerUserId); } catch { /* best effort */ }
  }
  if (adminUserId) {
    try { await root.auth.admin.deleteUser(adminUserId); } catch { /* best effort */ }
  }
}
