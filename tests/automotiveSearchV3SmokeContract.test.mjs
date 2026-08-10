import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('automotive V3 smoke exercises real private and approved-dealer database paths at scale', async () => {
  const smoke = await read('scripts/automotive-search-v3-smoke-local.mjs');
  assert.match(smoke, /public_listing_search_card_page_v3/);
  assert.match(smoke, /FINDIT_AUTOMOTIVE_SEARCH_FIXTURE_COUNT \?\? 120/);
  assert.match(smoke, /fixtureCount < 100/);
  assert.match(smoke, /business_type: 'car_dealership'/);
  assert.match(smoke, /category: 'car'/);
  assert.match(smoke, /status: 'approved'/);
  assert.match(smoke, /status: 'pending_review'/);
  assert.match(smoke, /update\(\{ status: 'available' \}\)/);
  assert.match(smoke, /sellerType: 'dealer'/);
  assert.match(smoke, /sellerType: 'private'/);
  assert.match(smoke, /model: 'Hilux'/);
  assert.match(smoke, /Object\.hasOwn\(row, 'attributes'\)/);
  assert.match(smoke, /Object\.hasOwn\(row, 'description'\)/);
  assert.match(smoke, /result\.length <= pageSize \+ 1/);
  assert.match(smoke, /must not repeat/);
  assert.match(smoke, /sort: 'price_asc', currency: 'USD'/);
  assert.match(smoke, /verified_private/);
  assert.match(smoke, /business_applications.*delete|from\('business_applications'\)\.delete/s);
  assert.match(smoke, /business_profiles.*delete|from\('business_profiles'\)\.delete/s);
  assert.match(smoke, /auth\.admin\.deleteUser/);
});
