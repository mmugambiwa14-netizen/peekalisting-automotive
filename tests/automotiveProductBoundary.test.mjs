import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('public shell is automotive-first without deleting reusable dormant routes', async () => {
  const [home, nav, topNav, app] = await Promise.all([
    source('src/pages/Home.jsx'),
    source('src/lib/navigationConfig.js'),
    source('src/components/layout/TopNav.jsx'),
    source('src/App.jsx'),
  ]);

  assert.match(home, /Find the car\. See more before you go\./);
  assert.match(home, /Newly listed cars/);
  assert.match(home, /Cars with Peeks|HomePeekRail/);
  assert.match(home, /to="\/dealers"/);
  assert.match(home, /to="\/services"/);
  assert.doesNotMatch(home, /DiscoverCategoryGrid/);
  assert.match(nav, /label: 'Sell'/);
  assert.doesNotMatch(nav, /label: 'Post'/);
  for (const label of ["'Cars'", "'Dealers'", "'Services'", "'Peeks'", "'Chats'"]) assert.match(topNav, new RegExp(`label: ${label}`));
  assert.match(topNav, /<span>Sell<\/span>/);
  assert.doesNotMatch(topNav, /<span>Post<\/span>/);
  assert.ok(app.includes('path="/post" element={<CreateListing />}'));
  assert.ok(app.includes('path="/dealers" element={<Dealers />}'));
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
  assert.match(config, /Array\.isArray\(defaults\.segments\)/);
  assert.match(config, /AUTOMOTIVE_SELLER_TYPES/);
  assert.match(step, /getCategoryTaxonomy\('car'/);
  assert.match(step, /launchVehicleCategoryOptions/);
  assert.match(step, /Submission is open; publication is controlled/);
  assert.doesNotMatch(step, /BusinessPublishingGate/);
});

test('private vehicle submission remains moderated and other domains remain curated', async () => {
  const [service, originalCreation, launchMigration, success] = await Promise.all([
    source('src/services/listingCreationService.js'),
    source('supabase/migrations/0021_v1_listing_creation_and_media.sql'),
    source('supabase/migrations/20260810150000_automotive_open_vehicle_submission.sql'),
    source('src/components/create-listing/PublishSuccess.jsx'),
  ]);

  assert.match(service, /if \(input\.kind !== 'car'\)/);
  assert.match(originalCreation, /pending_review/);
  assert.match(launchMigration, /if v_category = 'car'/);
  assert.match(launchMigration, /account\.status = 'active'/);
  assert.match(launchMigration, /business_category_approvals/);
  assert.match(launchMigration, /pending_review/);
  assert.match(launchMigration, /Vehicle submissions must enter review before publication/);
  assert.match(launchMigration, /when listing_row\.kind::text = 'car' then 'pending_review'/);
  assert.match(success, /Vehicle submitted for review/);
  assert.match(success, /Pending review/);
  assert.doesNotMatch(success, />Your listing is live</);
});

test('vehicle discovery exposes globally useful independent facets through a minimal public projection', async () => {
  const [search, filters, cards, repository, baseMigration, v3Migration, previewService, rollback] = await Promise.all([
    source('src/pages/Search.jsx'),
    source('src/components/search/VehicleFilters.jsx'),
    source('src/components/listings/ListingCard.jsx'),
    source('src/repositories/publicListingsRepository.js'),
    source('supabase/migrations/20260810151000_automotive_search_projection.sql'),
    source('supabase/migrations/20260810154000_automotive_model_seller_search.sql'),
    source('src/services/publicListingsService.js'),
    source('supabase/rollback/20260810154000_automotive_model_seller_search.rollback.sql'),
  ]);

  assert.match(search, /const TYPE = 'car'/);
  for (const field of ['model', 'sellerType', 'bodyType', 'drivetrain', 'importStatus', 'minYear', 'maxYear', 'maxMileage', 'peekOnly']) {
    assert.match(search, new RegExp(field));
    assert.match(filters, new RegExp(field));
  }
  assert.match(filters, /Any seller/);
  assert.match(cards, /listing\.seller_type === 'dealer'/);
  assert.match(cards, /label: 'Dealer'/);
  assert.match(cards, /listing\.seller_type === 'private'/);
  assert.match(cards, /label: 'Private seller'/);
  assert.doesNotMatch(cards, /verified seller|trust score|seller rating/i);
  assert.match(repository, /public_listing_search_card_page_v3/);
  assert.match(repository, /p_model: request\.model/);
  assert.match(repository, /p_seller_type: request\.sellerType/);
  assert.match(baseMigration, /attributes -> 'values' ->> 'body_type'/);
  assert.match(baseMigration, /join public\.listing_tours tour on tour\.id = slot\.current_tour_id/);
  assert.match(v3Migration, /idx_car_details_automotive_model_trgm/);
  assert.match(v3Migration, /model gin_trgm_ops/);
  assert.match(v3Migration, /normalized_model/);
  assert.match(v3Migration, /normalized_seller_type not in \('', 'dealer', 'private'\)/);
  assert.match(v3Migration, /profile\.business_type = 'car_dealership'/);
  assert.match(v3Migration, /profile\.verified = true/);
  assert.match(v3Migration, /approval\.category = 'car'/);
  assert.match(v3Migration, /approval\.status = 'approved'/);
  assert.match(v3Migration, /listing\.car_model ilike/);
  assert.match(v3Migration, /when listing\.kind::text <> 'car' then null/);
  assert.match(v3Migration, /when listing\.is_dealer then 'dealer'/);
  assert.match(v3Migration, /listing\.has_current_peek/);
  assert.match(previewService, /previewSellerType/);
  assert.match(previewService, /request\.model/);
  assert.match(previewService, /request\.sellerType/);
  assert.match(rollback, /drop function if exists public\.public_listing_search_card_page_v3/);
  assert.match(rollback, /drop index if exists public\.idx_car_details_automotive_model_trgm/);
  const privateReturnStart = v3Migration.indexOf('returns table (');
  const privateReturnEnd = v3Migration.indexOf(')\nlanguage plpgsql', privateReturnStart);
  assert.ok(privateReturnStart >= 0 && privateReturnEnd > privateReturnStart);
  assert.doesNotMatch(v3Migration.slice(privateReturnStart, privateReturnEnd), /attributes jsonb/);
});

test('automotive Peek surfaces ask for observable evidence instead of becoming a generic media feed', async () => {
  const [categories, feed, detail] = await Promise.all([
    source('src/domain/peekThreads/categories.js'),
    source('src/pages/Tours.jsx'),
    source('src/pages/CarDetail.jsx'),
  ]);
  assert.match(categories, /Walk around the exterior slowly in one continuous view/);
  assert.match(categories, /Show all four tyres and the tread clearly/);
  assert.match(categories, /dashboard and odometer/);
  assert.match(categories, /Show the engine bay clearly/);
  assert.match(categories, /personal details kept out of frame/);
  assert.match(feed, /const VEHICLE_PEEK_CATEGORY = 'car'/);
  assert.doesNotMatch(feed, /Property.*Cars.*Machinery.*Services/s);
  assert.match(feed, /not a mechanical inspection or a guarantee of vehicle condition/);
  assert.match(detail, /Captured through PeekaListing/);
  assert.match(detail, /Seller-declared/);
});

test('dealers and automotive services reuse existing systems with current approval boundaries', async () => {
  const [dealersRepository, dealersPage, dealerMigration, dealerRollback, servicesPage, servicesRepository, serviceTaxonomy, serviceRollback] = await Promise.all([
    source('src/repositories/dealersRepository.js'),
    source('src/pages/Dealers.jsx'),
    source('supabase/migrations/20260810153000_automotive_dealer_directory.sql'),
    source('supabase/rollback/20260810153000_automotive_dealer_directory.rollback.sql'),
    source('src/pages/Services.jsx'),
    source('src/repositories/servicesRepository.js'),
    source('supabase/migrations/20260810152000_automotive_service_taxonomy.sql'),
    source('supabase/rollback/20260810152000_automotive_service_taxonomy.rollback.sql'),
  ]);

  assert.match(dealersRepository, /public_automotive_dealers_page/);
  assert.match(dealerMigration, /join public\.users account on account\.id = profile\.user_id/);
  assert.match(dealerMigration, /account\.status = 'active'/);
  assert.match(dealerMigration, /profile\.business_type = 'car_dealership'/);
  assert.match(dealerMigration, /profile\.profile_type = 'dealer'/);
  assert.match(dealerMigration, /profile\.verified = true/);
  assert.match(dealerMigration, /approval\.category = 'car'/);
  assert.match(dealerMigration, /approval\.status = 'approved'/);
  assert.match(dealerRollback, /drop function if exists public\.public_automotive_dealers_page/);
  assert.match(dealerRollback, /drop function if exists private\.public_automotive_dealers_page/);
  assert.match(dealersPage, /View dealer inventory/);
  assert.match(servicesPage, /const AUTOMOTIVE_SERVICE_DOMAIN = 'mechanic'/);
  assert.match(servicesRepository, /contains\('subcategories', \[request\.specialization\]\)/);
  for (const specialization of ['pre_purchase_inspection', 'vehicle_diagnostics', 'tyres_wheels', 'panel_beating', 'vehicle_towing', 'vehicle_transport']) {
    assert.match(serviceTaxonomy, new RegExp(specialization));
  }
  assert.match(serviceTaxonomy, /is_active = true/);
  assert.doesNotMatch(serviceRollback, /delete from public\.categories/);
  assert.match(serviceRollback, /is_active = false/);
});
