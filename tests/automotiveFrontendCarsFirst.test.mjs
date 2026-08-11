import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Automotive frontend keeps Tours and Response Peek fail-closed', async () => {
  const [flags, app, nav, topNav, home, carDetail, serviceDetail, listingCard, serviceCard] = await Promise.all([
    read('src/lib/featureFlags.js'),
    read('src/App.jsx'),
    read('src/lib/navigationConfig.js'),
    read('src/components/layout/TopNav.jsx'),
    read('src/pages/Home.jsx'),
    read('src/pages/CarDetail.jsx'),
    read('src/pages/ServiceDetail.jsx'),
    read('src/components/listings/ListingCard.jsx'),
    read('src/components/services/ServiceCard.jsx'),
  ]);

  assert.match(flags, /tours:\s*false/);
  assert.match(flags, /toursPreview:\s*false/);
  assert.match(app, /path="\/peek" element={<Navigate to="\/" replace \/>}/);
  assert.match(app, /path="\/tours" element={<Navigate to="\/" replace \/>}/);
  assert.match(app, /path="\/peek-requests" element={<Navigate to="\/" replace \/>}/);
  assert.doesNotMatch(nav, /\/peek|Peeks|Peek moderation/);
  assert.doesNotMatch(topNav, /\/peek|Peeks/);
  assert.doesNotMatch(home, /HomePeekRail|Cars with Peeks|\/peek/);
  assert.doesNotMatch(carDetail, /PeekThreadsSection|PeekRequestIntentHandler|tour=|Current Peek/);
  assert.doesNotMatch(serviceDetail, /PeekThreadsSection|PeekRequestIntentHandler|tour=|Video Peek/);
  assert.doesNotMatch(listingCard, /tourSummary|tour=/);
  assert.doesNotMatch(serviceCard, /serviceTour|tour=/);
});

test('active Automotive surfaces expose only Cars, Services and approved business operations', async () => {
  const [saved, myListings, notificationCenter, adminListings, adminAudit, manifest, robots] = await Promise.all([
    read('src/pages/Saved.jsx'),
    read('src/pages/MyListings.jsx'),
    read('src/pages/NotificationCenter.jsx'),
    read('src/pages/admin/AdminListings.jsx'),
    read('src/pages/admin/AdminAuditLog.jsx'),
    read('public/manifest.webmanifest'),
    read('public/robots.txt'),
  ]);

  assert.match(saved, /savedCars/);
  assert.doesNotMatch(saved, /savedProperties|savedMachinery|MachineryGrid|Properties/);
  assert.match(myListings, /filter\(\(listing\) => listing\._type === 'car'\)/);
  assert.match(notificationCenter, /isActiveAutomotiveNotification/);
  assert.doesNotMatch(adminListings, /<SelectItem value="property"|<SelectItem value="machinery"/);
  assert.doesNotMatch(adminAudit, /value="property"|value="machinery"|value="listing_tour"/);
  assert.doesNotMatch(manifest, /property, vehicles, machinery/i);
  assert.doesNotMatch(robots, /property\/\*|machinery\/\*/);
});
