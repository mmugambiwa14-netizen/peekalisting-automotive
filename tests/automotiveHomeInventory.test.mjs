import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('home Cars inventory uses the same V3 public projection as automotive search', async () => {
  const [repository, service, home, card] = await Promise.all([
    read('src/repositories/publicListingsRepository.js'),
    read('src/services/publicListingsService.js'),
    read('src/pages/Home.jsx'),
    read('src/components/listings/ListingCard.jsx'),
  ]);

  const normalizedRepository = repository.replaceAll('\r\n', '\n');
  const latestFunction = normalizedRepository.match(/export async function findLatestAvailableListings[\s\S]*?\n}\n\nexport async function findSavedListingsByIds/)?.[0] || '';
  assert.ok(latestFunction, 'latest inventory function exists');
  assert.match(latestFunction, /if \(kind === 'car'\)/);
  assert.match(latestFunction, /public_listing_search_card_page_v3/);
  assert.match(latestFunction, /automotiveSearchParams\(\{ pageSize: limit \}\)/);
  assert.match(latestFunction, /cursor_value: _cursorValue/);
  assert.match(normalizedRepository, /suspension rules, seller-native currency, authoritative dealer identity/);
  assert.match(service, /findLatestAvailableListings/);
  assert.match(home, /getLatestPublicListings\('car', 8\)/);
  assert.match(card, /seller_type === 'dealer'/);
  assert.match(card, /seller_type === 'private'/);
});

test('dormant non-car latest inventory keeps the existing reusable table path', async () => {
  const repository = await read('src/repositories/publicListingsRepository.js');
  const normalizedRepository = repository.replaceAll('\r\n', '\n');
  const latestFunction = normalizedRepository.match(/export async function findLatestAvailableListings[\s\S]*?\n}\n\nexport async function findSavedListingsByIds/)?.[0] || '';
  assert.match(latestFunction, /\.from\('listings'\)/);
  assert.match(latestFunction, /\.in\('status', \['available', 'under_offer'\]\)/);
});
