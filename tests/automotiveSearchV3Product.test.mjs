import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('automotive search UI exposes model and authoritative seller-type facets', async () => {
  const [search, filters, cards, config, contracts] = await Promise.all([
    read('src/pages/Search.jsx'),
    read('src/components/search/VehicleFilters.jsx'),
    read('src/components/listings/ListingCard.jsx'),
    read('src/lib/automotiveConfig.js'),
    read('src/services/searchContracts.js'),
  ]);

  assert.match(config, /AUTOMOTIVE_SELLER_TYPES/);
  for (const field of ['model', 'sellerType', 'bodyType', 'drivetrain', 'importStatus', 'minYear', 'maxYear', 'maxMileage', 'peekOnly']) {
    assert.match(search, new RegExp(field));
    assert.match(filters, new RegExp(field));
  }
  assert.match(filters, /Any seller/);
  assert.match(contracts, /new Set\(\['dealer', 'private'\]\)/);
  assert.match(cards, /listing\.seller_type === 'dealer'/);
  assert.match(cards, /label: 'Dealer'/);
  assert.match(cards, /listing\.seller_type === 'private'/);
  assert.match(cards, /label: 'Private seller'/);
  assert.doesNotMatch(cards, /verified seller|trust score|seller rating/i);
});

test('active automotive search runtime uses V3 and passes model plus seller type to the database', async () => {
  const [repository, publicationContract] = await Promise.all([
    read('src/repositories/publicListingsRepository.js'),
    read('tests/listingPublicationJourneyContracts.test.mjs'),
  ]);
  assert.match(repository, /public_listing_search_card_page_v3/);
  assert.match(repository, /p_model: request\.model/);
  assert.match(repository, /p_seller_type: request\.sellerType/);
  // The shared publication contract remains owned by main; this isolated V3
  // test prevents search-version changes from creating merge conflicts there.
  assert.match(publicationContract, /public cards details search and seller inventory use available listing boundaries/);
});

test('V3 derives dealer identity from approved marketplace state and keeps the public projection thin', async () => {
  const [baseMigration, v3Migration, previewService, rollback] = await Promise.all([
    read('supabase/migrations/20260810151000_automotive_search_projection.sql'),
    read('supabase/migrations/20260810154000_automotive_model_seller_search.sql'),
    read('src/services/publicListingsService.js'),
    read('supabase/rollback/20260810154000_automotive_model_seller_search.rollback.sql'),
  ]);

  assert.match(baseMigration, /join public\.listing_tours tour on tour\.id = slot\.current_tour_id/);
  assert.match(baseMigration, /tour\.moderation_status = 'approved'/);
  assert.match(baseMigration, /tour\.published_at is not null/);
  assert.match(v3Migration, /idx_car_details_automotive_model_trgm/);
  assert.match(v3Migration, /model extensions\.gin_trgm_ops/);
  assert.match(v3Migration, /normalized_model/);
  assert.match(v3Migration, /normalized_seller_type not in \('', 'dealer', 'private'\)/);
  assert.match(v3Migration, /profile\.business_type = 'car_dealership'/);
  assert.match(v3Migration, /profile\.profile_type = 'dealer'/);
  assert.match(v3Migration, /profile\.verified = true/);
  assert.match(v3Migration, /approval\.category = 'car'/);
  assert.match(v3Migration, /approval\.status = 'approved'/);
  assert.match(v3Migration, /listing\.car_detail_listing_id is not null/);
  assert.match(v3Migration, /listing\.car_model ilike/);
  assert.match(v3Migration, /when listing\.kind::text <> 'car' then null/);
  assert.match(v3Migration, /when listing\.is_dealer then 'dealer'/);
  assert.match(v3Migration, /listing\.has_current_peek/);
  assert.match(previewService, /previewSellerType/);
  assert.match(previewService, /request\.model/);
  assert.match(previewService, /request\.sellerType/);
  assert.match(rollback, /drop function if exists public\.public_listing_search_card_page_v3/);
  assert.match(rollback, /drop index if exists public\.idx_car_details_automotive_model_trgm/);

  const normalizedV3Migration = v3Migration.replaceAll('\r\n', '\n');
  const privateReturnStart = normalizedV3Migration.indexOf('returns table (');
  const privateReturnEnd = normalizedV3Migration.indexOf(')\nlanguage plpgsql', privateReturnStart);
  assert.ok(privateReturnStart >= 0 && privateReturnEnd > privateReturnStart);
  assert.doesNotMatch(normalizedV3Migration.slice(privateReturnStart, privateReturnEnd), /attributes jsonb|description text|contact_phone text|contact_email text/);
});

test('dealer directory rollback remains paired and non-destructive', async () => {
  const [migration, rollback] = await Promise.all([
    read('supabase/migrations/20260810153000_automotive_dealer_directory.sql'),
    read('supabase/rollback/20260810153000_automotive_dealer_directory.rollback.sql'),
  ]);
  assert.match(migration, /join public\.users account on account\.id = profile\.user_id/);
  assert.match(migration, /profile\.verified = true/);
  assert.match(migration, /approval\.category = 'car'/);
  assert.match(migration, /approval\.status = 'approved'/);
  assert.match(rollback, /drop function if exists public\.public_automotive_dealers_page/);
  assert.match(rollback, /drop function if exists private\.public_automotive_dealers_page/);
  assert.doesNotMatch(rollback, /delete from|truncate|drop table/i);
});
