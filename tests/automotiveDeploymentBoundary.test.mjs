import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync('.github/workflows/automotive-staging.yml', 'utf8');
const verifier = readFileSync('scripts/verify-automotive-staging.mjs', 'utf8');

const OLD_FINDIT_STAGING_REF = 'bwgklpxoetrrkutottdb';
const FINDIT_MARKETPLACE_REF = 'jvbpxnfxkptuexgssplj';

test('automotive staging deploys only to its isolated Cloudflare and Supabase boundary', () => {
  assert.match(workflow, /peekalisting-automotive-staging/);
  assert.match(workflow, /cars-staging\.peekalisting\.com/);
  assert.match(workflow, /PEEKALISTING_AUTOMOTIVE_STAGING_PROJECT_REF/);
  assert.ok(workflow.includes(`!= "${OLD_FINDIT_STAGING_REF}"`));
  assert.ok(workflow.includes(`!= "${FINDIT_MARKETPLACE_REF}"`));
  assert.match(workflow, /workflow_dispatch/);
  assert.doesNotMatch(workflow, /branches:\s*\n\s*- main/);
});

test('hosted verification exercises Cars V3 and the approved dealer directory', () => {
  assert.match(verifier, /public_listing_search_card_page_v3/);
  assert.match(verifier, /p_kind:\s*'car'/);
  assert.match(verifier, /public_automotive_dealers_page/);
  assert.match(verifier, /seller_type/);
  assert.doesNotMatch(verifier, /public_listing_search_card_page_v1/);
  assert.doesNotMatch(verifier, /p_kind:\s*'property'/);
});

test('hosted verifier independently refuses inherited FindIt Supabase targets', () => {
  assert.match(verifier, new RegExp(OLD_FINDIT_STAGING_REF));
  assert.match(verifier, new RegExp(FINDIT_MARKETPLACE_REF));
  assert.match(verifier, /PEEKALISTING_EXPECTED_PROJECT_REF/);
});
