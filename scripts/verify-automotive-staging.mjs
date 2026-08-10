import process from 'node:process';

const origin = process.env.PEEKALISTING_AUTOMOTIVE_STAGING_ORIGIN || process.argv[2];
if (!origin) {
  console.error('Usage: node ./scripts/verify-automotive-staging.mjs https://cars-staging.peekalisting.com');
  process.exit(2);
}

let base;
try {
  base = new URL(origin);
} catch {
  console.error('Automotive staging verification failed: origin is not a valid URL');
  process.exit(2);
}

if (base.protocol !== 'https:') {
  console.error('Automotive staging verification failed: origin must use HTTPS');
  process.exit(2);
}

const OLD_FINDIT_STAGING_REF = 'bwgklpxoetrrkutottdb';
const FINDIT_MARKETPLACE_REF = 'jvbpxnfxkptuexgssplj';
const failures = [];

const request = async (path, options = {}) => {
  const url = new URL(path, base);
  const response = await fetch(url, { redirect: 'follow', ...options });
  const body = await response.text();
  return { response, body, url };
};

const requirePage = async (path) => {
  try {
    const { response, body } = await request(path);
    if (response.status !== 200) failures.push(`${path}: expected HTTP 200, got ${response.status}`);
    if (!body.includes('<div id="root"></div>')) failures.push(`${path}: SPA shell missing`);
  } catch (error) {
    failures.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

let root;
try {
  root = await request('/');
  if (root.response.status !== 200) failures.push(`/: expected HTTP 200, got ${root.response.status}`);
  if (!root.body.includes('<div id="root"></div>')) failures.push('/: SPA root missing');
} catch (error) {
  failures.push(`/: ${error instanceof Error ? error.message : String(error)}`);
}

for (const path of [
  '/search',
  '/dealers',
  '/services',
  '/login',
  '/admin',
  '/auth/callback?returnTo=%2F',
  '/automotive-staging-deep-link-check',
]) {
  await requirePage(path);
}

const requiredHeaders = [
  ['content-security-policy', (value) => value?.includes("script-src 'self'") && !value.includes("script-src 'unsafe-inline'")],
  ['strict-transport-security', (value) => value?.includes('max-age=')],
  ['x-content-type-options', (value) => value?.toLowerCase() === 'nosniff'],
  ['x-frame-options', (value) => value?.toUpperCase() === 'DENY'],
  ['referrer-policy', (value) => Boolean(value)],
  ['permissions-policy', (value) => Boolean(value)],
];
for (const [header, predicate] of requiredHeaders) {
  const value = root?.response.headers.get(header);
  if (!predicate(value)) failures.push(`/: missing or unsafe ${header}`);
}

try {
  const { response, body } = await request('/manifest.webmanifest');
  if (response.status !== 200) failures.push(`/manifest.webmanifest: expected HTTP 200, got ${response.status}`);
  if (!response.headers.get('content-type')?.includes('manifest')) failures.push('/manifest.webmanifest: wrong content type');
  const manifest = JSON.parse(body);
  if (manifest.display !== 'standalone') failures.push('/manifest.webmanifest: display must be standalone');
  if (manifest.start_url !== '/') failures.push('/manifest.webmanifest: start_url must be /');
  if (manifest.scope !== '/') failures.push('/manifest.webmanifest: scope must be /');
  if (!Array.isArray(manifest.icons) || manifest.icons.length < 1) failures.push('/manifest.webmanifest: icons missing');
} catch (error) {
  failures.push(`/manifest.webmanifest: ${error instanceof Error ? error.message : String(error)}`);
}

try {
  const { response, body } = await request('/sw.js');
  if (response.status !== 200) failures.push(`/sw.js: expected HTTP 200, got ${response.status}`);
  if (!response.headers.get('content-type')?.includes('javascript')) failures.push('/sw.js: wrong content type');
  if (response.headers.get('service-worker-allowed') !== '/') failures.push('/sw.js: Service-Worker-Allowed must be /');
  if (!body.includes("addEventListener('fetch'")) failures.push('/sw.js: fetch handler missing');
} catch (error) {
  failures.push(`/sw.js: ${error instanceof Error ? error.message : String(error)}`);
}

if (process.env.VITE_FEATURE_MAPS === 'true') {
  for (const path of ['/vendor/maplibre/maplibre-gl.js', '/vendor/maplibre/maplibre-gl.css']) {
    try {
      const { response } = await request(path);
      if (response.status !== 200) failures.push(`${path}: expected HTTP 200, got ${response.status}`);
    } catch (error) {
      failures.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();
const expectedProjectRef = (
  process.env.PEEKALISTING_EXPECTED_PROJECT_REF
  || process.env.FINDIT_EXPECTED_PROJECT_REF
  || ''
).trim();

if (!supabaseUrl || !supabaseAnonKey || !expectedProjectRef) {
  failures.push('Automotive staging requires VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and PEEKALISTING_EXPECTED_PROJECT_REF');
} else {
  try {
    if ([OLD_FINDIT_STAGING_REF, FINDIT_MARKETPLACE_REF].includes(expectedProjectRef)) {
      failures.push('Automotive staging must not target either inherited FindIt Supabase project');
    }

    const supabaseOrigin = new URL(supabaseUrl);
    if (supabaseOrigin.protocol !== 'https:') failures.push('Supabase staging URL must use HTTPS');
    if (supabaseOrigin.hostname !== `${expectedProjectRef}.supabase.co`) {
      failures.push('Supabase staging URL does not match the guarded automotive project ref');
    }

    const headers = {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    };

    const settingsResponse = await fetch(new URL('/auth/v1/settings', supabaseUrl), { headers });
    if (settingsResponse.status !== 200) {
      failures.push(`Supabase Auth settings: expected HTTP 200, got ${settingsResponse.status}`);
    } else {
      const settings = await settingsResponse.json();
      if (process.env.VITE_AUTH_GOOGLE_ENABLED === 'true' && settings.external?.google !== true) {
        failures.push('Supabase Auth: Google is enabled in the app but not in Supabase');
      }
    }

    const carSearchResponse = await fetch(new URL('/rest/v1/rpc/public_listing_search_card_page_v3', supabaseUrl), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_kind: 'car',
        p_country_code: 'ZW',
        p_currency: '',
        p_query: '',
        p_category: '',
        p_location_id: '',
        p_min_price: null,
        p_max_price: null,
        p_min_bedrooms: null,
        p_brand: '',
        p_model: '',
        p_seller_type: '',
        p_condition: '',
        p_fuel_type: '',
        p_transmission: '',
        p_body_type: '',
        p_drivetrain: '',
        p_import_status: '',
        p_min_year: null,
        p_max_year: null,
        p_max_mileage: null,
        p_peek_only: false,
        p_sort: 'newest',
        p_cursor_value: null,
        p_cursor_id: null,
        p_limit: 24,
      }),
    });
    if (carSearchResponse.status !== 200) {
      failures.push(`Supabase automotive V3 search: expected HTTP 200, got ${carSearchResponse.status}`);
    } else {
      const rows = await carSearchResponse.json();
      if (!Array.isArray(rows)) {
        failures.push('Supabase automotive V3 search: expected an array response');
      } else {
        for (const row of rows.slice(0, 24)) {
          if (row?.kind !== 'car') failures.push('Supabase automotive V3 search returned a non-car listing');
          if (!['dealer', 'private'].includes(row?.seller_type)) {
            failures.push('Supabase automotive V3 search returned an invalid seller_type');
          }
        }
      }
    }

    const dealerResponse = await fetch(new URL('/rest/v1/rpc/public_automotive_dealers_page', supabaseUrl), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_query: '',
        p_cursor_created_at: null,
        p_cursor_id: null,
        p_limit: 24,
      }),
    });
    if (dealerResponse.status !== 200) {
      failures.push(`Supabase automotive dealer directory: expected HTTP 200, got ${dealerResponse.status}`);
    } else if (!Array.isArray(await dealerResponse.json())) {
      failures.push('Supabase automotive dealer directory: expected an array response');
    }

    const toursEnabled = process.env.VITE_FEATURE_TOURS === 'true' || process.env.TOURS_BACKEND_ENABLED === 'true';
    if (toursEnabled) {
      const tourFeedResponse = await fetch(new URL('/functions/v1/tour-feed', supabaseUrl), {
        method: 'POST',
        headers: { ...headers, Origin: base.origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'car', location: '', query: '', cursor: null, limit: 24 }),
      });
      if (tourFeedResponse.status !== 200) {
        failures.push(`Supabase automotive Peek feed: expected HTTP 200, got ${tourFeedResponse.status}`);
      } else {
        const payload = await tourFeedResponse.json();
        if (!Array.isArray(payload?.items)) failures.push('Supabase automotive Peek feed: items array missing');
        if (Array.isArray(payload?.items) && payload.items.some((item) => item?.listingType !== 'car')) {
          failures.push('Supabase automotive Peek feed returned a non-car item');
        }
      }
    }

    if (process.env.VITE_FEATURE_GOOGLE_OAUTH === 'true') {
      const redirectTo = encodeURIComponent(new URL('/auth/callback?next=/', base).toString());
      const googleResponse = await fetch(
        new URL(`/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`, supabaseUrl),
        { headers: { apikey: supabaseAnonKey }, redirect: 'manual' },
      );
      if (googleResponse.status !== 302 || !googleResponse.headers.get('location')?.startsWith('https://accounts.google.com/')) {
        failures.push('Supabase Auth: Google OAuth did not produce a Google authorization redirect');
      }
    }
  } catch (error) {
    failures.push(`Supabase automotive staging checks: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length > 0) {
  console.error('Automotive staging verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Automotive staging verification passed for ${base.host}: SPA, PWA, security headers, isolated Supabase, Cars V3 search and dealer directory verified.`);
