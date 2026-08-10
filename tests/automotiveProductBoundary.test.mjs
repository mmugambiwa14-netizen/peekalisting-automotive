import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('public shell is automotive-first without deleting reusable dormant routes', async () => {
  const [home, nav, app] = await Promise.all([
    source('src/pages/Home.jsx'),
    source('src/lib/navigationConfig.js'),
    source('src/App.jsx'),
  ]);

  assert.match(home, /Find the car\. See more before you go\./);
  assert.match(home, /Newly listed cars/);
  assert.match(home, /Cars with Peeks|HomePeekRail/);
  assert.doesNotMatch(home, /DiscoverCategoryGrid/);
  assert.match(nav, /label: 'Sell'/);
  assert.doesNotMatch(nav, /label: 'Post'/);
  assert.ok(app.includes('path="/post" element={<CreateListing />}'));
  assert.doesNotMatch(app, /BusinessPublishingGate><CreateListing/);
  assert.match(app, /path="\/property\/:id"/);
  assert.match(app, /path="\/machinery\/:id"/);
});

test('launch taxonomy is narrower than the reusable vehicle ontology', async () => {
  const [config, step] = await Promise.all([
    source('src/lib/automotiveConfig.js'),
    source('src/components/create-listing/Step1Category.jsx'),
  ]);
  assert.match(config, /new Set\(\['car', 'bakkie', 'van'\]\)/);
  assert.match(config, /defaults\.offer_type.*AUTOMOTIVE_LAUNCH_OFFER/);
  assert.match(config, /defaults\.parts_family/);
  assert.match(step, /getCategoryTaxonomy\('car'/);
  assert.match(step, /launchVehicleCategoryOptions/);
  assert.match(step, /Submission is open; publication is controlled/);
  assert.doesNotMatch(step, /BusinessPublishingGate/);
});

test('private vehicle submission remains moderated and other domains remain curated', async () => {
  const [service, originalCreation, launchMigration] = await Promise.all([
    source('src/services/listingCreationService.js'),
    source('supabase/migrations/0021_v1_listing_creation_and_media.sql'),
    source('supabase/migrations/20260810150000_automotive_open_vehicle_submission.sql'),
  ]);

  assert.match(service, /if \(input\.kind !== 'car'\)/);
  assert.match(originalCreation, /pending_review/);
  assert.match(launchMigration, /if v_category = 'car'/);
  assert.match(launchMigration, /account\.status = 'active'/);
  assert.match(launchMigration, /business_category_approvals/);
  assert.match(launchMigration, /pending_review/);
});

test('vehicle discovery exposes globally useful independent facets', async () => {
  const [search, filters, repository, migration] = await Promise.all([
    source('src/pages/Search.jsx'),
    source('src/components/search/VehicleFilters.jsx'),
    source('src/repositories/publicListingsRepository.js'),
    source('supabase/migrations/20260810151000_automotive_search_projection.sql'),
  ]);

  assert.match(search, /const TYPE = 'car'/);
  for (const field of ['bodyType', 'drivetrain', 'importStatus', 'minYear', 'maxYear', 'maxMileage', 'peekOnly']) {
    assert.match(search, new RegExp(field));
    assert.match(filters, new RegExp(field));
  }
  assert.match(repository, /public_listing_search_card_page_v2/);
  assert.match(migration, /attributes -> 'values' ->> 'body_type'/);
  assert.match(migration, /attributes -> 'values' ->> 'drivetrain'/);
  assert.match(migration, /attributes -> 'values' ->> 'import_status'/);
  assert.match(migration, /listing_tour_slots/);
  assert.match(migration, /p_max_mileage/);
  assert.match(migration, /kind = 'car'::public\.listing_kind/);
});

test('automotive Peek prompts ask for observable evidence instead of generic video', async () => {
  const categories = await source('src/domain/peekThreads/categories.js');
  assert.match(categories, /Walk around the exterior slowly in one continuous view/);
  assert.match(categories, /Show all four tyres and the tread clearly/);
  assert.match(categories, /dashboard and odometer/);
  assert.match(categories, /Show the engine bay clearly/);
  assert.match(categories, /personal details kept out of frame/);
});
