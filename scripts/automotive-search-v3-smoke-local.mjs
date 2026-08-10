import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { assertSmokeTarget } from './lib/smoke-target.mjs';

const url = process.env.FINDIT_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const anonKey = process.env.FINDIT_SUPABASE_ANON_KEY;
const secretKey = process.env.FINDIT_SUPABASE_SECRET_KEY;
const smokeTarget = assertSmokeTarget(url, 'The automotive search V3 smoke test');
if (!anonKey || !secretKey) throw new Error('A Supabase publishable key and secret key are required.');

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const root = createClient(url, secretKey, options);
const publicClient = createClient(url, anonKey, options);
const stamp = Date.now();
const marker = `autoscale${stamp}`;
const password = `Peeka!Auto${stamp}`;
const pageSize = 24;
const fixtureCount = Number(process.env.FINDIT_AUTOMOTIVE_SEARCH_FIXTURE_COUNT ?? 120);
const half = fixtureCount / 2;
const privateEmail = `${marker}-private@example.test`;
const dealerEmail = `${marker}-dealer@example.test`;
let privateUserId;
let dealerUserId;
let businessProfileId;
let businessApplicationId;

function success(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message ?? 'unknown error'}`);
  return result.data;
}

function authenticatedClient() {
  return createClient(url, anonKey, options);
}

async function signIn(email) {
  const client = authenticatedClient();
  success(await client.auth.signInWithPassword({ email, password }), `sign in ${email}`);
  return client;
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

function listingRows(userId, sellerName, count, offset) {
  const baseTime = Date.UTC(2026, 6, 1);
  return Array.from({ length: count }, (_, index) => {
    const sequence = offset + index;
    return {
      kind: 'car',
      seller_id: userId,
      seller_name: sellerName,
      title: `${marker} Toyota ${sequence % 2 === 0 ? 'Hilux' : 'Corolla'} ${String(sequence).padStart(4, '0')}`,
      description: 'Disposable automotive V3 search fixture',
      price: 10000 + sequence,
      currency: 'USD',
      native_price: 10000 + sequence,
      native_currency: 'USD',
      country_code: 'ZW',
      category: 'cars_sale',
      listing_type: 'sale',
      status: 'pending_review',
      photos: [],
      views: sequence,
      created_at: new Date(baseTime + sequence * 1000).toISOString(),
    };
  });
}

try {
  if (!Number.isInteger(fixtureCount) || fixtureCount < 100 || fixtureCount > 500 || fixtureCount % 2 !== 0) {
    throw new Error('FINDIT_AUTOMOTIVE_SEARCH_FIXTURE_COUNT must be an even integer from 100 to 500.');
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

  const [privateClient, dealerClient] = await Promise.all([signIn(privateEmail), signIn(dealerEmail)]);
  const privateListings = success(await privateClient.from('listings').insert(listingRows(privateUserId, 'Automotive Private Fixture', half, 0)).select('id,title'), 'submit private Cars fixtures');
  const dealerListings = success(await dealerClient.from('listings').insert(listingRows(dealerUserId, `${marker} Motors`, half, half)).select('id,title'), 'submit dealer Cars fixtures');
  const inserted = [...privateListings, ...dealerListings];
  assert.equal(inserted.length, fixtureCount);

  const sequenceById = new Map(inserted.map((row) => [row.id, Number(row.title.slice(-4))]));
  success(await root.from('car_details').insert(inserted.map((row) => {
    const sequence = sequenceById.get(row.id);
    return {
      listing_id: row.id,
      brand: 'Toyota',
      model: sequence % 2 === 0 ? `Hilux Workmate ${sequence}` : `Corolla Quest ${sequence}`,
      year: 2010 + (sequence % 15),
      mileage: 40000 + sequence * 100,
      fuel_type: sequence % 2 === 0 ? 'diesel' : 'petrol',
      transmission: sequence % 3 === 0 ? 'automatic' : 'manual',
      condition: 'used',
    };
  })), 'insert automotive detail fixtures');

  success(await root.from('listings').update({ status: 'available' }).in('id', inserted.map((row) => row.id)), 'publish automotive smoke fixtures as trusted backend');

  const all = await traverse();
  assert.equal(all.length, fixtureCount, 'V3 keyset traversal reaches the complete automotive fixture set');
  assert.deepEqual(
    all.map((row) => Number(row.title.slice(-4))),
    Array.from({ length: fixtureCount }, (_, index) => fixtureCount - index - 1),
    'V3 newest traversal remains deterministic beyond 100 Cars',
  );

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
  console.log(`Verified ${fixtureCount} Cars across private and approved-dealer sellers, >100-row keysets, partial model search, seller-type composition, thin projection and seller-native price ordering.`);
} finally {
  const listingOwners = [privateUserId, dealerUserId].filter(Boolean);
  if (listingOwners.length) {
    try { await root.from('listings').delete().in('seller_id', listingOwners).ilike('title', `${marker}%`); } catch { /* best effort */ }
  }
  if (businessApplicationId) {
    try { await root.from('business_applications').delete().eq('id', businessApplicationId); } catch { /* best effort */ }
  }
  if (businessProfileId) {
    try { await root.from('business_profiles').delete().eq('id', businessProfileId); } catch { /* best effort */ }
  }
  if (privateUserId) {
    try { await root.auth.admin.deleteUser(privateUserId); } catch { /* best effort */ }
  }
  if (dealerUserId) {
    try { await root.auth.admin.deleteUser(dealerUserId); } catch { /* best effort */ }
  }
}
