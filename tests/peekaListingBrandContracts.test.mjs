import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('navigation uses the canonical PeekaListing wordmark and mark', async () => {
  const logo = await read('src/components/BrandLogo.jsx');
  assert.match(logo, /aria-label="PeekaListing"/);
  assert.match(logo, /peekalisting-binoculars\.svg/);
  assert.match(logo, /Peeka/);
  assert.match(logo, /Listing/);
  assert.doesNotMatch(logo, />Find</);
});

test('browser and PWA metadata identify PeekaListing', async () => {
  const html = await read('index.html');
  const manifest = JSON.parse(await read('public/manifest.webmanifest'));
  assert.match(html, /PeekaListing Marketplace/);
  assert.match(html, /application-name" content="PeekaListing"/);
  assert.match(html, /peekalisting-binoculars\.svg/);
  assert.equal(manifest.name, 'PeekaListing Marketplace');
  assert.equal(manifest.short_name, 'PeekaListing');
  assert.ok(
    manifest.icons.every((icon) => icon.src.startsWith('/brand/peekalisting-')),
    'every manifest icon must be a PeekaListing asset',
  );
  assert.ok(
    manifest.icons.every((icon) => !/findit/i.test(icon.src)),
    'install metadata must never reference a retired FindIt raster',
  );
});

test('startup and push fallbacks never expose the former product name', async () => {
  const startup = await read('src/main.jsx');
  const push = await read('public/push-sw.js');
  assert.match(startup, /PeekaListing startup failed/);
  assert.match(startup, /PeekaListing preview could not start/);
  assert.doesNotMatch(startup, /FindIt/);
  assert.match(push, /title: 'PeekaListing'/);
  assert.match(push, /peekalisting-binoculars\.svg/);
});

test('live user-facing surfaces never expose the former product name', async () => {
  const paths = [
    'src/pages/PropertyDetail.jsx',
    'src/pages/CarDetail.jsx',
    'src/pages/MachineryDetail.jsx',
    'src/pages/ServiceDetail.jsx',
    'src/pages/SellerProfile.jsx',
    'src/pages/Profile.jsx',
    'src/pages/Tours.jsx',
    'src/components/AppErrorBoundary.jsx',
    'src/components/AuthLayout.jsx',
    'src/components/auth/AccountBlocked.jsx',
    'src/components/auth/GuestPromptSheet.jsx',
    'src/components/layout/AppLayout.jsx',
    'src/components/layout/BottomNav.jsx',
    'src/components/layout/MobileTopNav.jsx',
    'src/components/layout/SiteFooter.jsx',
    'src/components/layout/TopNav.jsx',
    'src/components/listings/ContactButtons.jsx',
    'src/components/listings/ListingDetailLayout.jsx',
    'src/components/listings/ListingDetailTabs.jsx',
    'src/components/listings/MessageDialog.jsx',
    'src/components/pwa/InstallPrompt.jsx',
    'src/components/discover/HomePeekRail.jsx',
    'src/components/tours/TourUploader.jsx',
    'src/services/listingTourContracts.js',
    'public/offline.html',
  ];
  const sources = await Promise.all(paths.map(read));
  for (let index = 0; index < sources.length; index += 1) {
    assert.doesNotMatch(sources[index], /\bFindIt\b/, `${paths[index]} must not expose the retired product name`);
  }
});

test('service worker rotates PeekaListing caches and retires legacy caches', async () => {
  const worker = await read('public/sw.js');
  assert.match(worker, /peekalisting-shell-/);
  assert.match(worker, /peekalisting-assets-/);
  assert.match(worker, /peekalisting-binoculars\.svg/);
  assert.match(worker, /name\.startsWith\('findit-'\)/);
});

test('live help content reflects automotive moderation and qualified business approval', async () => {
  const faq = await read('src/pages/FAQs.jsx');
  assert.match(faq, /verify dealerships and automotive businesses/);
  assert.match(faq, /New vehicle submissions are reviewed before they become publicly discoverable/);
  assert.match(faq, /reporting by itself does not automatically remove the content/);
  assert.match(faq, /not a mechanical inspection, ownership verification, or guarantee of condition/);
  assert.doesNotMatch(faq, /Validated listings publish immediately/);
  assert.doesNotMatch(faq, /messaging has completed migration/);
  assert.doesNotMatch(faq, /FindIt/);
});
