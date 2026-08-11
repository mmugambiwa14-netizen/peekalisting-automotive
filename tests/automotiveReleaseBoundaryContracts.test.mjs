import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [migration, verifier, workflow] = await Promise.all([
  readFile(new URL('../supabase/migrations/20260811050000_automotive_release_boundary_attestation.sql', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/verify-automotive-release-boundary.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/automotive-staging.yml', import.meta.url), 'utf8'),
]);

test('hosted release attestation covers the critical automotive security boundary', () => {
  assert.match(migration, /automotive_release_boundary_ready/);
  assert.match(migration, /not function_record\.prosecdef/);
  assert.match(migration, /relrowsecurity/);
  assert.match(migration, /TRUNCATE/);
  assert.match(migration, /MAINTAIN/);
  assert.match(migration, /contact_phone/);
  assert.match(migration, /automotive_public_browser_acl_guard/);
  assert.match(migration, /public_listing_search_card_page_v3/);
  assert.match(migration, /public_automotive_dealers_page/);
  assert.match(migration, /business_category_approvals/);
  assert.match(migration, /peek_request_fulfilments/);
  assert.match(migration, /saved_services/);
  assert.match(migration, /web_push_notification_preferences/);
  assert.match(migration, /get_public_seller_profile\(text\).*is null/s);
  assert.match(migration, /security invoker/i);
});

test('hosted verifier requires a true database release attestation from the isolated project', () => {
  assert.match(verifier, /automotive_release_boundary_ready/);
  assert.match(verifier, /ready !== true/);
  assert.match(verifier, /OLD_FINDIT_STAGING_REF/);
  assert.match(verifier, /FINDIT_MARKETPLACE_REF/);
  assert.match(verifier, /expectedProjectRef\.supabase\.co|\$\{expectedProjectRef\}\.supabase\.co/);
  assert.doesNotMatch(verifier, /service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

test('automotive staging deployment runs the hosted release-boundary verifier', () => {
  assert.match(workflow, /verify-automotive-release-boundary\.mjs/);
});
