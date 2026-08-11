import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [listingUpload, marketplaceUpload, deleteAccount, releaseVerifier] = await Promise.all([
  readFile(new URL('../supabase/functions/listing-image-upload/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/functions/marketplace-image-upload/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/functions/delete-account/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/verify-automotive-release-boundary.mjs', import.meta.url), 'utf8'),
]);

const coreFunctions = [
  ['listing-image-upload', listingUpload],
  ['marketplace-image-upload', marketplaceUpload],
  ['delete-account', deleteAccount],
];

test('core automotive Edge Functions explicitly support the isolated staging browser origin', () => {
  for (const [name, source] of coreFunctions) {
    assert.match(source, /https:\/\/cars-staging\.peekalisting\.com/, `${name} must allow automotive staging`);
    assert.match(source, /request\.method === "OPTIONS"|req\.method === "OPTIONS"/, `${name} must handle CORS preflight`);
    assert.match(source, /status:\s*204/, `${name} preflight must be non-mutating HTTP 204`);
    assert.match(source, /Access-Control-Allow-Origin/, `${name} must emit an explicit allowed origin`);
    assert.match(source, /Access-Control-Allow-Methods[^\n]*POST, OPTIONS/, `${name} must expose only the required browser methods`);
    assert.match(source, /Vary[^\n]*Origin/, `${name} must vary responses by Origin`);
    assert.doesNotMatch(source, /Access-Control-Allow-Origin[^\n]*\*/, `${name} must not use wildcard CORS`);
  }
});

test('core automotive Edge Functions require a bearer-authenticated browser session for mutation', () => {
  for (const [name, source] of coreFunctions) {
    assert.match(source, /authorization/i, `${name} must inspect Authorization`);
    assert.match(source, /Bearer /, `${name} must require a Bearer token`);
    assert.match(source, /auth\.getUser\(\)/, `${name} must validate the current user session`);
  }
});

test('image upload functions retain trusted-image and authorization boundaries', () => {
  for (const [name, source] of [
    ['listing-image-upload', listingUpload],
    ['marketplace-image-upload', marketplaceUpload],
  ]) {
    assert.match(source, /prepareTrustedImage/, `${name} must inspect and sanitize uploaded images`);
    assert.match(source, /MAX_BYTES/, `${name} must enforce the shared image size limit`);
    assert.match(source, /sha256Hex/, `${name} must checksum the trusted image bytes`);
    assert.match(source, /upload_not_authorized/, `${name} must fail closed when its upload intent is rejected`);
    assert.match(source, /createSignedUrl/, `${name} must return a short-lived preview rather than a public object URL`);
  }

  assert.match(listingUpload, /authorize_listing_image_upload/);
  assert.match(listingUpload, /complete_listing_image_upload/);
  assert.match(marketplaceUpload, /authorize_marketplace_image_upload/);
  assert.match(marketplaceUpload, /complete_marketplace_image_upload/);
});

test('account deletion keeps explicit destructive confirmation and browser-safe CORS', () => {
  assert.match(deleteAccount, /trim\(\)\.toUpperCase\(\) !== "DELETE"/);
  assert.match(deleteAccount, /prepare_own_account_deletion/);
  assert.match(deleteAccount, /auth\.admin\.updateUserById/);
  assert.match(deleteAccount, /deleted-\$\{user\.id\.replaceAll/);
  assert.match(deleteAccount, /ban_duration/);
});

test('hosted release verification probes every core Edge Function without mutating state', () => {
  for (const [name] of coreFunctions) {
    assert.match(releaseVerifier, new RegExp(`'${name}'`));
  }
  assert.match(releaseVerifier, /method:\s*'OPTIONS'/);
  assert.match(releaseVerifier, /functionProbe\.status !== 204/);
  assert.match(releaseVerifier, /access-control-allow-origin/);
  assert.match(releaseVerifier, /access-control-allow-methods/);
});
