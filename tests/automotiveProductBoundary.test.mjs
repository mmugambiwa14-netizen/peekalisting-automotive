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
  assert.ok(app.includes('path="/dealer/:id" element={<PublicBusinessProfile />}'));
  assert.ok(app.includes('path="/dealer-onboarding" element={<DealerOnboarding />}'));
  assert.doesNotMatch(app, /featureFlags\.businessProfiles && <Route path="\/dealer\/:id"/);
  assert.doesNotMatch(app, /featureFlags\.businessProfiles && <Route path="\/dealer-onboarding"/);
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
  assert.match(success, /Vehicle submitted for review/);
  assert.match(success, /Pending review/);
  assert.doesNotMatch(success, />Your listing is live</);
});

test('vehicle discovery exposes globally useful independent facets through a minimal public projection', async () => {
  const [search, filters, repository, migration, preview] = await Promise.all([
    source('src/pages/Search.jsx'),
    source('src/components/search/VehicleFilters.jsx'),
    source('src/repositories/publicListingsRepository.js'),
    source('supabase/migrations/20260810151000_automotive_search_projection.sql'),
    source('src/services/localPreviewListings.js'),
  ]);

  assert.match(search, /const TYPE = 'car'/);
  for (const field of ['bodyType', 'drivetrain', 'importStatus', 'minYear', 'maxYear', 'maxMileage', 'peekOnly']) {
    assert.match(search, new RegExp(field));
    assert.match(filters, new RegExp(field));
    assert.match(preview, new RegExp(field));
  }
  assert.match(repository, /public_listing_search_card_page_v2/);
  assert.match(migration, /attributes -> 'values' ->> 'body_type'/);
  assert.match(migration, /attributes -> 'values' ->> 'drivetrain'/);
  assert.match(migration, /attributes -> 'values' ->> 'import_status'/);
  assert.match(migration, /listing_tour_slots/);
  assert.match(migration, /join public\.listing_tours/);
  assert.match(migration, /moderation_status = 'approved'/);
  assert.match(migration, /published_at is not null/);
  assert.match(migration, /p_max_mileage/);
  assert.match(migration, /kind = 'car'::public\.listing_kind/);
  assert.match(migration, /car\.fuel_type::text = p_fuel_type/);
  assert.match(migration, /car\.transmission::text = p_transmission/);
  const privateReturnStart = migration.indexOf('returns table (');
  const privateReturnEnd = migration.indexOf(')\nlanguage plpgsql', privateReturnStart);
  assert.ok(privateReturnStart >= 0 && privateReturnEnd > privateReturnStart);
  assert.doesNotMatch(migration.slice(privateReturnStart, privateReturnEnd), /attributes jsonb/);
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
  const [dealersRepository, dealersPage, dealerMigration, servicesPage, servicesRepository, serviceTaxonomy, serviceRollback] = await Promise.all([
    source('src/repositories/dealersRepository.js'),
    source('src/pages/Dealers.jsx'),
    source('supabase/migrations/20260810153000_automotive_dealer_directory.sql'),
    source('src/pages/Services.jsx'),
    source('src/repositories/servicesRepository.js'),
    source('supabase/migrations/20260810152000_automotive_service_taxonomy.sql'),
    source('supabase/rollback/20260810152000_automotive_service_taxonomy.rollback.sql'),
  ]);

  assert.match(dealersRepository, /public_automotive_dealers_page/);
  assert.match(dealerMigration, /account\.status = 'active'/);
  assert.match(dealerMigration, /business_type = 'car_dealership'/);
  assert.match(dealerMigration, /approval\.category = 'car'/);
  assert.match(dealerMigration, /approval\.status = 'approved'/);
  assert.match(dealersPage, /View dealer inventory/);
  assert.match(dealersPage, /to="\/dealer-onboarding"/);
  assert.match(servicesPage, /const AUTOMOTIVE_SERVICE_DOMAIN = 'mechanic'/);
  assert.match(servicesRepository, /contains\('subcategories', \[request\.specialization\]\)/);
  for (const specialization of ['pre_purchase_inspection', 'vehicle_diagnostics', 'tyres_wheels', 'panel_beating', 'vehicle_towing', 'vehicle_transport']) {
    assert.match(serviceTaxonomy, new RegExp(specialization));
  }
  assert.match(serviceTaxonomy, /is_active = true/);
  assert.doesNotMatch(serviceRollback, /delete from public\.categories/);
  assert.match(serviceRollback, /is_active = false/);
});

test('dealer onboarding uses one Cars-only business application state machine', async () => {
  const [page, profileForm, publishingService, profileService, bootstrap, profilePage, publicProfile] = await Promise.all([
    source('src/pages/DealerOnboarding.jsx'),
    source('src/components/business/BusinessProfileForm.jsx'),
    source('src/services/businessPublishingService.js'),
    source('src/services/businessProfilesService.js'),
    source('supabase/migrations/20260807011000_verified_business_profile_bootstrap.sql'),
    source('src/pages/Profile.jsx'),
    source('src/pages/PublicBusinessProfile.jsx'),
  ]);

  assert.match(page, /getMyPublishingAccess/);
  assert.match(page, /submitBusinessApplication/);
  assert.match(page, /requestedCategories: \['car'\]/);
  assert.match(page, /requestAdditionalBusinessCategories\(\['car'\]\)/);
  assert.match(page, /applicationStatus === 'request_category'/);
  assert.match(page, /second business application is neither needed nor allowed/);
  assert.match(page, /existing_application_pending/);
  assert.match(page, /respondToBusinessApplication/);
  assert.match(page, /fixedBusinessType="car_dealership"/);
  assert.match(page, /saveOwnerBusinessProfile/);
  assert.match(page, /Cars business approval is active/);
  assert.doesNotMatch(page, /requestedCategories: \['property'|requestedCategories: \['machinery'|requestedCategories: \['service'/);
  assert.match(profileForm, /fixedBusinessType/);
  assert.match(publishingService, /submit_business_application/);
  assert.match(publishingService, /request_additional_business_categories/);
  assert.match(profileService, /saveOwnerBusinessProfile/);
  assert.match(bootstrap, /bootstrap_business_profile_verification/);
  assert.match(bootstrap, /sync_business_profile_verification/);
  assert.match(profilePage, /Dealer onboarding/);
  assert.match(publicProfile, /!dealer && <VerifiedBusinessBadge/);
  assert.match(publicProfile, /Dealership profile/);
});
