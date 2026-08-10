import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('V2 reuses the mature V1 transaction while the automotive trigger normalizes its legacy live state into review', async () => {
  const [privateV1, v2, automotive] = await Promise.all([
    read('supabase/migrations/0101_private_authenticated_rpc_implementations.sql'),
    read('supabase/migrations/20260808081300_listing_schema_v2_submission.sql'),
    read('supabase/migrations/20260810150000_automotive_open_vehicle_submission.sql'),
  ]);

  const privateCreation = privateV1.match(/create or replace function private\.create_v1_listing_submission[\s\S]*?\n\$\$;/)?.[0] || '';
  assert.ok(privateCreation, 'private V1 listing transaction exists');
  assert.match(privateCreation, /'available'/);
  assert.match(v2, /private\.create_v1_listing_submission/);
  assert.match(automotive, /Vehicle submissions must enter review before/);
  assert.match(automotive, /new\.status := 'pending_review'::public\.listing_status/);
  assert.doesNotMatch(automotive, /if new\.status <> 'pending_review'[\s\S]*raise exception/);
});

test('production-faithful automotive scale smoke enters through image upload, V2 submission and admin approval', async () => {
  const smoke = await read('scripts/automotive-search-v3-smoke-local.mjs');
  assert.match(smoke, /listing-image-upload/);
  assert.match(smoke, /create_v2_listing_submission/);
  assert.match(smoke, /created\.status, 'pending_review'/);
  assert.match(smoke, /admin_moderate_marketplace_item/);
  assert.match(smoke, /p_action: 'publish'/);
  assert.doesNotMatch(smoke, /\.from\('listings'\)\.insert/);
  assert.doesNotMatch(smoke, /\.from\('listings'\)\.update\(\{ status: 'available'/);
});
